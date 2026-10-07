import test from 'node:test';
import assert from 'node:assert/strict';
import { createEnvelopeCodec } from '../backend/security/envelope.ts';
import {
  assertMutationOrigin,
  readJsonBody,
  privateJson,
  privateFailure,
} from '../backend/http/guard.ts';
import {
  signInReturnPath,
  flowCookieName,
  readFlowCookie,
  serializeFlowCookie,
} from '../backend/auth/navigation.ts';
const origin = 'https://agentgrid.me';
const key = () => ({
  id: 'current',
  material: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
});

test('private flow envelopes are encrypted, purpose/origin-bound, bounded and expiring', async () => {
  const material = key();
  const codec = await createEnvelopeCodec([material], origin);
  const value = { verifier: 'sensitive-local-fixture', returnTo: '/workspace/' };
  const token = await codec.seal('oauth', value, 600, 1000);
  assert.ok(!token.includes(value.verifier));
  assert.deepEqual(await codec.open('oauth', token, 1001), value);
  assert.equal(await codec.open('challenge', token, 1001), null);
  assert.equal(await codec.open('oauth', token, 1600), null);
  assert.equal(await codec.open('oauth', token, 800), null);
  const otherOrigin = await createEnvelopeCodec([material], 'https://other.example');
  assert.equal(await otherOrigin.open('oauth', token, 1001), null);
  const parts = token.split('.');
  parts[2] = (parts[2][0] === 'a' ? 'b' : 'a') + parts[2].slice(1);
  assert.equal(await codec.open('oauth', parts.join('.'), 1001), null);
  assert.equal(await codec.open('oauth', 'not-an-envelope', 1001), null);
  await assert.rejects(codec.seal('challenge', value, 301, 1000));
  await assert.rejects(codec.seal('oauth', { value: 'x'.repeat(3000) }, 100, 1000));
  await assert.rejects(codec.seal('oauth', { number: NaN }, 100, 1000));
  await assert.rejects(createEnvelopeCodec([material, material], origin));
});

test('envelope rotation reads the retained old key but new state uses only the active key', async () => {
  const old = key();
  old.id = 'previous';
  const next = key();
  const oldCodec = await createEnvelopeCodec([old], origin);
  const token = await oldCodec.seal('session', { sessionId: 'synthetic-session' }, 60, 1000);
  const rotated = await createEnvelopeCodec([next, old], origin);
  assert.deepEqual(await rotated.open('session', token, 1001), { sessionId: 'synthetic-session' });
  assert.ok((await rotated.seal('csrf', { token: 'synthetic' }, 30, 1000)).startsWith('current.'));
  const retired = await createEnvelopeCodec([next], origin);
  assert.equal(await retired.open('session', token, 1001), null);
});

test('mutations reject forged/missing origins, mismatched hosts and cross-site requests', () => {
  const make = (headers = {}, url = origin + '/api/session') =>
    new Request(url, { method: 'POST', headers: { origin, ...headers } });
  assert.doesNotThrow(() => assertMutationOrigin(make(), origin));
  for (const headers of [
    { origin: 'null' },
    { origin: 'https://attacker.example' },
    { host: 'attacker.example' },
    { 'sec-fetch-site': 'cross-site' },
    { 'sec-fetch-site': 'same-site' },
  ])
    assert.throws(() => assertMutationOrigin(make(headers), origin));
  assert.throws(() =>
    assertMutationOrigin(new Request(origin + '/api/session', { method: 'POST' }), origin),
  );
  assert.throws(() => assertMutationOrigin(new Request(origin + '/api/session'), origin));
  assert.throws(() =>
    assertMutationOrigin(make({}, 'https://attacker.example/api/session'), origin),
  );
});

test('body parsing bounds streamed bytes and refuses alternate media, malformed UTF-8 and JSON', async () => {
  const make = (body, headers = {}) =>
    new Request(origin + '/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body,
    });
  assert.deepEqual(await readJsonBody(make('{"task":"synthetic"}')), { task: 'synthetic' });
  for (const request of [
    make('not-json'),
    make('{}', { 'content-type': 'text/plain' }),
    make('x'.repeat(200)),
    make(new Uint8Array([0xff, 0xfe])),
    make('{}', { 'content-length': '999999' }),
  ])
    await assert.rejects(readJsonBody(request, 100));
  const response = privateJson({ status: 'signed-out' });
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  const failed = privateFailure(new Error('Synthetic private provider value must not be echoed.'));
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: 'service-unavailable' });
});

test('redirects and flow cookies cannot cross the application boundary or inject headers', () => {
  assert.equal(
    signInReturnPath('/agents/inbox-priority-triage/'),
    '/agents/inbox-priority-triage/',
  );
  for (const value of [
    '//attacker.example/',
    'https://attacker.example/',
    '/api/admin/',
    '/%2f%2fattacker.example/',
    '/workspace/?code=private',
    '/agents/a/\\evil',
    null,
  ])
    assert.equal(signInReturnPath(value), '/workspace/');
  const name = flowCookieName('session', origin);
  const cookie = serializeFlowCookie(name, 'opaque.session', origin, 600);
  assert.ok(cookie.includes('HttpOnly; SameSite=Lax'));
  assert.ok(cookie.endsWith('; Secure'));
  assert.ok(!cookie.includes('Domain='));
  assert.equal(
    readFlowCookie(new Request(origin, { headers: { cookie: `${name}=a; ${name}=b` } }), name),
    null,
  );
  assert.equal(
    readFlowCookie(new Request(origin, { headers: { cookie: `${name}=opaque.session` } }), name),
    'opaque.session',
  );
  assert.throws(() => serializeFlowCookie(name, 'value\r\nInjected: header', origin, 600));
  assert.throws(() => serializeFlowCookie(name, 'opaque', 'http://localhost:3027', 600));
});
