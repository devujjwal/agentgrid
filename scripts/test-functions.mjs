/** Compiled workerd acceptance with synthetic keys. No real provider traffic. */
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const require = createRequire(import.meta.url);
const wranglerRoot = dirname(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  resolve(wranglerRoot, 'package.json'),
)('miniflare');
const vendorMatcher = stripTypeScriptTypes(
  await readFile(resolve(wranglerRoot, 'templates/pages-dev-util.ts'), 'utf8'),
);
const { isRoutingRuleMatch } = await import(
  'data:text/javascript;base64,' + Buffer.from(vendorMatcher).toString('base64')
);
const routes = JSON.parse(await readFile('.agentgrid-functions/_routes.json', 'utf8'));
const invokesWorker = (path) =>
  !routes.exclude.some((rule) => isRoutingRuleMatch(path, rule)) &&
  routes.include.some((rule) => isRoutingRuleMatch(path, rule));
for (const path of [
  '/agents/',
  '/agents/unknown-resource/',
  '/creators/synthetic_creator/',
  '/api/community/creator/',
  '/api/identity/',
  '/api/workspace/',
  '/api/moderation/reviews/',
  '/api/admin/profile/',
  '/api/admin/profile-decision/',
  '/api/community/reviews/',
  '/auth/callback/',
  '/auth/callback',
])
  assert.equal(invokesWorker(path), true, path);
for (const path of ['/', '/workspace/', '/sign-in/', '/auth/callback/extra'])
  assert.equal(invokesWorker(path), false, path);

const origin = 'https://agentgrid-staging.pages.dev';
const bindings = {
  AGENTGRID_STAGE: 'preview',
  AGENTGRID_ORIGIN: origin,
  NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(24),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(24),
  RESEND_API_KEY: 're_' + 'r'.repeat(24),
  RESEND_FROM_EMAIL: 'signin@mail.agentgrid.me',
  AGENTGRID_PILOT_EMAILS: 'synthetic@example.test',
  AGENTGRID_RATE_KEY: randomBytes(32).toString('base64url'),
  AGENTGRID_ENVELOPE_KEYS: JSON.stringify([
    { id: 'synthetic', material: randomBytes(32).toString('base64url') },
  ]),
};
let outboundCalls = 0;
// Miniflare's HTTP bridge overwrites Host with its ephemeral loopback listener.
// The synthetic wrapper restores the request URL's host before the real guard;
// production source is unchanged. Tests still exercise wrong URL origins.
const entry = `import worker from './worker.js';
export default { fetch(request, env, context) {
  const headers = new Headers(request.headers);
  headers.set('host', new URL(request.url).host);
  if (headers.has('x-agentgrid-synthetic-origin')) {
    headers.set('origin', headers.get('x-agentgrid-synthetic-origin'));
    headers.delete('x-agentgrid-synthetic-origin');
  }
  const publicEnvironment = Object.fromEntries([
    'AGENTGRID_STAGE', 'AGENTGRID_ORIGIN',
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
  ].map(key => [key, env[key]]));
  const effective = new URL(request.url).pathname.startsWith('/api/community/') ? publicEnvironment : env;
  return worker.fetch(new Request(request, { headers }), effective, context);
}};`;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    modules: [
      { type: 'ESModule', path: resolve('.agentgrid-functions/acceptance.mjs'), contents: entry },
      {
        type: 'ESModule',
        path: resolve('.agentgrid-functions/worker.js'),
        contents: await readFile('.agentgrid-functions/index.js', 'utf8'),
      },
    ],
    compatibilityDate: '2026-10-07',
    bindings,
    serviceBindings: { ASSETS: async () => new Response('static-fallback') },
    outboundService: async () => {
      outboundCalls++;
      return new Response('Synthetic acceptance forbids provider traffic', { status: 502 });
    },
  }),
);
try {
  const worker = await mf.getWorker();
  const send = (path, init = {}, base = origin) =>
    worker.fetch(base + path, {
      ...init,
      redirect: 'manual',
      headers: { 'CF-Connecting-IP': '127.0.0.1', ...init.headers },
    });
  const unknownAgent = await send('/agents/unknown-resource/');
  assert.equal(unknownAgent.status, 404);
  assert.equal(unknownAgent.headers.get('cache-control'), 'private, no-store');
  const listing = await send('/agents/');
  assert.equal(await listing.text(), 'static-fallback');
  const initial = await send('/api/identity/');
  assert.equal(initial.status, 200);
  const identity = await initial.json();
  assert.deepEqual(Object.keys(identity).sort(), ['csrf', 'signedIn']);
  assert.equal(identity.signedIn, false);
  assert.match(identity.csrf, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(initial.headers.get('cache-control'), 'private, no-store');
  assert.equal(initial.headers.get('x-content-type-options'), 'nosniff');
  assert.match(initial.headers.get('x-robots-tag'), /noindex/);
  assert.match(initial.headers.get('set-cookie'), /__Host-agentgrid_csrf=.*HttpOnly.*Secure/);
  const cookie = initial.headers
    .getSetCookie()
    .filter((value) => value.startsWith('__Host-agentgrid_csrf='))[0]
    .split(';')[0];
  const reused = await send('/api/identity/', { headers: { cookie } });
  assert.equal(reused.status, 200);
  assert.equal((await reused.json()).csrf, identity.csrf);
  const deniedRemoval = await send('/api/workspace/deactivate/', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      'x-agentgrid-synthetic-origin': origin,
      'x-agentgrid-csrf': identity.csrf,
    },
    body: JSON.stringify({
      profileId: '10000000-0000-4000-8000-000000000001',
      username: 'synthetic_owner',
      understandsRemoval: true,
    }),
  });
  assert.equal(deniedRemoval.status, 401);
  const deniedAdministrator = await send('/api/admin/profile/?username=synthetic_owner');
  assert.equal(deniedAdministrator.status, 401);
  assert.deepEqual(await deniedAdministrator.json(), { error: 'not-signed-in' });
  const deniedProfileDecision = await send('/api/admin/profile-decision/', {
    method: 'POST',
    headers: {
      cookie,
      'content-type': 'application/json',
      'x-agentgrid-synthetic-origin': origin,
      'x-agentgrid-csrf': identity.csrf,
    },
    body: JSON.stringify({
      profileId: '10000000-0000-4000-8000-000000000001',
      expectedRevision: 1,
      decision: 'suspend',
      explanation: 'Synthetic authorization boundary test only.',
    }),
  });
  assert.equal(deniedProfileDecision.status, 401);
  const workspace = await send('/api/workspace/');
  assert.equal(workspace.status, 401);
  assert.deepEqual(await workspace.json(), { error: 'not-signed-in' });
  const moderation = await send('/api/moderation/reviews/?state=pending&offset=0');
  assert.equal(moderation.status, 401);
  assert.deepEqual(await moderation.json(), { error: 'not-signed-in' });
  const invalidCreator = await send('/api/community/creator/?username=bad%40name');
  assert.equal(invalidCreator.status, 400);
  const invalidCreatorPage = await send('/creators/not%40allowed/');
  assert.equal(invalidCreatorPage.status, 404);
  assert.equal(invalidCreatorPage.headers.get('set-cookie'), null);
  const publicReview = await send('/api/community/reviews/?resourceId=invalid');
  assert.equal(publicReview.status, 400);
  assert.deepEqual(await publicReview.json(), { error: 'invalid-request' });
  assert.equal(publicReview.headers.get('set-cookie'), null);
  const publicWrongOrigin = await send(
    '/api/community/reviews/?resourceId=invalid',
    {},
    'https://untrusted.example.test',
  );
  assert.equal(publicWrongOrigin.status, 403);
  const callback = await send('/auth/callback/');
  assert.equal(callback.status, 303);
  assert.equal(callback.headers.get('location'), '/sign-in/?notice=verification-unavailable');
  const wrongOrigin = await send('/api/identity/', {}, 'https://untrusted.example.test');
  assert.equal(wrongOrigin.status, 403);
  const denied = await send('/api/identity/email/', {
    method: 'POST',
    // Miniflare rejects a non-loopback Origin at its HTTP bridge. Restore the
    // synthetic origin inside the fixture, before the unchanged real guard.
    headers: { 'x-agentgrid-synthetic-origin': origin, 'content-type': 'application/json', cookie },
    body: JSON.stringify({ email: 'synthetic@example.test' }),
  });
  assert.equal(denied.status, 403);
  assert.deepEqual(await denied.json(), { error: 'request-refused' });
  const staticResource = await send('/agents/');
  assert.equal(await staticResource.text(), 'static-fallback');
  assert.equal(outboundCalls, 0);
  console.log(
    'Compiled workerd acceptance passed: routing, AEAD cookie round-trip, origin/CSRF, private denial and static fallback; no provider traffic.',
  );
} finally {
  await mf.dispose();
}
