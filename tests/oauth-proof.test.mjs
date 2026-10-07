import test from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { once } from 'node:events';
import { createOAuthProofServer } from '../scripts/oauth-proof-server.mjs';

const provider = 'https://example.supabase.co';

async function fixture(t, { wrongIdentity = false, unsafeDestination = false } = {}) {
  const calls = [];
  let verified = 0;
  const server = createOAuthProofServer(
    { url: provider, publishableKey: 'public-test-key' },
    {
      onVerified: async () => verified++,
      clientFactory: (_url, _key, options) => {
        assert.equal(options.auth.flowType, 'pkce');
        assert.equal(options.auth.autoRefreshToken, false);
        assert.equal(options.auth.detectSessionInUrl, false);
        return {
          auth: {
            signInWithOAuth: async (input) => {
              calls.push(['start', input]);
              return {
                data: {
                  url:
                    (unsafeDestination ? 'https://attacker.example' : provider) +
                    '/auth/v1/authorize',
                },
                error: null,
              };
            },
            exchangeCodeForSession: async (code) => {
              calls.push(['exchange', code]);
              options.auth.storage.setItem('test-session', 'private-session');
              return { data: { session: { access_token: 'private-session' } }, error: null };
            },
            getUser: async () => ({
              data: {
                user: {
                  email: wrongIdentity ? 'different@example.com' : 'devujjwal1989@gmail.com',
                  identities: [{ provider: 'google' }],
                },
              },
              error: null,
            }),
            signOut: async (input) => {
              calls.push(['logout', input]);
              return { error: null };
            },
          },
        };
      },
    },
  );
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const send = (path, { method = 'GET', headers = {}, body = '' } = {}) =>
    new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: '127.0.0.1',
          port: server.address().port,
          path,
          method,
          headers: { host: 'localhost:3027', ...headers },
        },
        (res) => {
          let text = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => (text += chunk));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, text }));
        },
      );
      req.on('error', reject);
      req.end(body);
    });
  const home = await send('/');
  const cookie = home.headers['set-cookie'][0].split(';')[0];
  const csrf = home.text.match(/name="csrf" value="([A-Za-z0-9_-]+)"/)[1];
  const start = (overrides = {}) =>
    send('/auth/start', {
      method: 'POST',
      body: new URLSearchParams({ csrf }).toString(),
      headers: {
        cookie,
        origin: 'http://localhost:3027',
        'content-type': 'application/x-www-form-urlencoded',
      },
      ...overrides,
    });
  return { send, home, cookie, start, calls, verified: () => verified };
}

test('OAuth proof rejects forged origins, CSRF, unknown hosts and unbound callbacks', async (t) => {
  const f = await fixture(t);
  assert.match(f.home.headers['set-cookie'][0], /HttpOnly; SameSite=Lax/);
  assert.equal(f.home.headers['referrer-policy'], 'same-origin');
  assert.match(
    f.home.headers['content-security-policy'],
    /form-action 'self' https:\/\/example.supabase.co https:\/\/accounts.google.com/,
  );
  assert.equal((await f.send('/', { headers: { host: 'attacker.example' } })).status, 403);
  assert.equal(
    (
      await f.start({
        headers: {
          cookie: f.cookie,
          origin: 'https://attacker.example',
          'content-type': 'application/x-www-form-urlencoded',
        },
      })
    ).status,
    403,
  );
  assert.equal((await f.start({ body: 'csrf=wrong' })).status, 403);
  assert.equal((await f.start({ body: 'csrf=' + encodeURIComponent('é'.repeat(43)) })).status, 403);
  assert.equal((await f.send('/auth/callback/?code=unbound')).status, 403);
  assert.equal(f.calls.length, 0);
});

test('OAuth proof verifies identity, uses only local sign-out and consumes callback once', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.start()).status, 303);
  assert.equal((await f.start()).status, 403);
  const result = await f.send('/auth/callback/?code=private-code', {
    headers: { cookie: f.cookie },
  });
  assert.equal(result.status, 303);
  assert.equal(result.headers.location, '/verified');
  assert.equal(f.verified(), 1);
  assert.deepEqual(f.calls.find(([name]) => name === 'logout')[1], { scope: 'local' });
  assert.equal(
    (await f.send('/auth/callback/?code=private-code', { headers: { cookie: f.cookie } })).status,
    403,
  );
  const proof = await f.send('/verified', { headers: { cookie: f.cookie } });
  assert.equal(proof.status, 200);
  assert.doesNotMatch(proof.text, /private-code|private-session/);
  assert.equal((await f.send('/verified')).status, 404);
});

test('OAuth proof rejects unapproved redirects and cleans up mismatched identities', async (t) => {
  const unsafe = await fixture(t, { unsafeDestination: true });
  const rejected = await unsafe.start();
  assert.equal(rejected.status, 400);
  assert.equal(rejected.headers.location, undefined);
  const wrong = await fixture(t, { wrongIdentity: true });
  await wrong.start();
  assert.equal(
    (await wrong.send('/auth/callback/?code=private-code', { headers: { cookie: wrong.cookie } }))
      .status,
    400,
  );
  assert.equal(wrong.verified(), 0);
  assert.deepEqual(wrong.calls.find(([name]) => name === 'logout')[1], { scope: 'local' });
  assert.equal((await wrong.send('/verified', { headers: { cookie: wrong.cookie } })).status, 404);
});
