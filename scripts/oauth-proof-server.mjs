/** Local infrastructure proof. Never publish or use as the production auth server. */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { validateEnvironment } from './verify-environment.mjs';

const ORIGIN = 'http://localhost:3027';
const EXPECTED_EMAIL = 'devujjwal1989@gmail.com';
const COOKIE = 'agentgrid_oauth_proof';
const randomToken = () => randomBytes(32).toString('base64url');
const cookieFor = (id) => `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`;

function page(title, content) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title></head><body><main><h1>${title}</h1>${content}</main></body></html>`;
}

function equalToken(left, right) {
  if (typeof left !== 'string') return false;
  const supplied = Buffer.from(left);
  const expected = Buffer.from(right);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createOAuthProofServer(
  configuration,
  { clientFactory = createClient, onVerified = async () => {} } = {},
) {
  const flows = new Map();
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    // Preserve same-origin POST Origin validation; suppress cross-origin referrers.
    response.setHeader('Referrer-Policy', 'same-origin');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-Robots-Tag', 'noindex, nofollow');
    response.setHeader(
      'Content-Security-Policy',
      `default-src 'none'; form-action 'self' ${configuration.url} https://accounts.google.com; frame-ancestors 'none'; base-uri 'none'`,
    );
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    const html = (status, title, text) => {
      response.statusCode = status;
      response.end(page(title, text));
    };
    const redirect = (location) => {
      response.statusCode = 303;
      response.setHeader('Location', location);
      response.end();
    };
    if (request.headers.host !== 'localhost:3027')
      return html(403, 'Local proof only', '<p>Unexpected host.</p>');
    for (const [id, flow] of flows) if (Date.now() > flow.expires) flows.delete(id);
    const url = new URL(request.url, ORIGIN);
    const id = request.headers.cookie
      ?.split(';')
      .map((value) => value.trim())
      .find((value) => value.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1);
    const flow = flows.get(id);
    try {
      if (request.method === 'GET' && url.pathname === '/') {
        if (flows.size >= 8)
          return html(
            503,
            'Proof capacity reached',
            '<p>Wait for existing proof challenges to expire.</p>',
          );
        const storage = new Map();
        const freshId = randomToken();
        const csrf = randomToken();
        const client = clientFactory(configuration.url, configuration.publishableKey, {
          auth: {
            flowType: 'pkce',
            persistSession: true,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storageKey: 'agentgrid_oauth_proof_' + freshId,
            storage: {
              getItem: (key) => storage.get(key) ?? null,
              setItem: (key, value) => storage.set(key, value),
              removeItem: (key) => storage.delete(key),
            },
          },
          global: {
            fetch: (input, init) =>
              fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(20_000) }),
          },
        });
        flows.set(freshId, {
          csrf,
          client,
          storage,
          expires: Date.now() + 600_000,
          started: false,
          used: false,
          verified: false,
        });
        response.setHeader('Set-Cookie', cookieFor(freshId));
        return html(
          200,
          'AgentGrid Google sign-in verification',
          `<p>This local infrastructure check requests identity, email and basic profile only. It validates and signs out its test session without publishing a profile.</p><form method="post" action="/auth/start"><input type="hidden" name="csrf" value="${csrf}"><button type="submit">Verify Google sign-in</button></form>`,
        );
      }
      if (request.method === 'POST' && url.pathname === '/auth/start') {
        if (
          !flow ||
          flow.started ||
          request.headers.origin !== ORIGIN ||
          request.headers['content-type'] !== 'application/x-www-form-urlencoded'
        )
          return html(403, 'Sign-in rejected', '<p>The local challenge is missing or invalid.</p>');
        let body = '';
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 2048)
            return html(413, 'Sign-in rejected', '<p>The request is too large.</p>');
        }
        if (!equalToken(new URLSearchParams(body).get('csrf'), flow.csrf))
          return html(403, 'Sign-in rejected', '<p>The local challenge is invalid.</p>');
        flow.started = true;
        const authorization = await flow.client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: ORIGIN + '/auth/callback/',
            skipBrowserRedirect: true,
            scopes: 'openid email profile',
          },
        });
        if (authorization.error || !authorization.data.url)
          throw new Error('OAuth initiation failed');
        const destination = new URL(authorization.data.url);
        if (
          destination.origin !== configuration.url ||
          destination.pathname !== '/auth/v1/authorize'
        )
          throw new Error('Unexpected authorization destination');
        return redirect(destination.href);
      }
      if (request.method === 'GET' && url.pathname === '/auth/callback/') {
        if (!flow || !flow.started || flow.used)
          return html(403, 'Callback rejected', '<p>No active single-use local challenge.</p>');
        flow.used = true;
        const code = url.searchParams.get('code');
        if (!code || code.length > 2048 || url.searchParams.has('error'))
          throw new Error('OAuth callback failed');
        try {
          const exchange = await flow.client.auth.exchangeCodeForSession(code);
          if (exchange.error || !exchange.data.session) throw new Error('PKCE exchange failed');
          const verified = await flow.client.auth.getUser(exchange.data.session.access_token);
          if (
            verified.error ||
            verified.data.user?.email !== EXPECTED_EMAIL ||
            !verified.data.user.identities?.some((identity) => identity.provider === 'google')
          )
            throw new Error('Unexpected verified identity');
          const logout = await flow.client.auth.signOut({ scope: 'local' });
          if (logout.error) throw new Error('Local sign-out failed');
          await onVerified();
          flow.verified = true;
        } finally {
          if (!flow.verified) await flow.client.auth.signOut({ scope: 'local' });
          flow.storage.clear();
          flow.client = null;
        }
        return redirect('/verified');
      }
      if (request.method === 'GET' && url.pathname === '/verified' && flow?.verified)
        return html(
          200,
          'Google sign-in verified',
          '<p>Real Google sign-in, PKCE code exchange, server-verified Google identity and local-only sign-out passed.</p><p>No tokens, public profile or community activity were published.</p>',
        );
      return html(404, 'Not found', '<p>No proof result is available here.</p>');
    } catch {
      // Never echo OAuth errors, URLs, codes, provider tokens or sessions.
      return html(
        400,
        'Google verification did not complete',
        '<p>No credentials were displayed. Review provider configuration or restart the local challenge.</p>',
      );
    }
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (
    process.argv[2] !== '--owner-google-test' ||
    process.env.CI ||
    validateEnvironment(process.env).length
  )
    throw new Error('Explicit local owner-test configuration required.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url !== 'https://lxecbrvzpmgjmsqiachc.supabase.co')
    throw new Error('Expected approved test project required.');
  const server = createOAuthProofServer(
    { url, publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
    {
      onVerified: async () => {
        const gitDir = execFileSync('git', ['rev-parse', '--absolute-git-dir'], {
          encoding: 'utf8',
        }).trim();
        await writeFile(
          resolve(gitDir, 'agentgrid-google-oauth-proof.json'),
          JSON.stringify(
            {
              project_ref: 'lxecbrvzpmgjmsqiachc',
              client_id: process.env.GOOGLE_CLIENT_ID,
              google_identity_verified: true,
              pkce_exchange_passed: true,
              local_signout_passed: true,
            },
            null,
            2,
          ) + '\n',
          { mode: 0o600, flag: 'wx' },
        );
        console.log(
          'Real Google identity, PKCE exchange and local-only sign-out passed. No tokens logged.',
        );
      },
    },
  );
  server.listen(3027, '127.0.0.1', () =>
    console.log(
      'Local OAuth proof ready at http://localhost:3027; never deploy this proof server.',
    ),
  );
}
