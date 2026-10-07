import test from 'node:test';
import assert from 'node:assert/strict';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
import { authConfiguration } from '../backend/auth/configuration.ts';
import { createPrivateMac } from '../backend/security/mac.ts';
import { authenticatedSession } from '../backend/auth/sessions.ts';
import { HttpFailure } from '../backend/http/guard.ts';

async function emailLogin(fixture) {
  assert.equal((await fixture.request('/api/identity/')).data.signedIn, false);
  assert.equal(
    (
      await fixture.request('/api/identity/email/', {
        email: 'OWNER@example.test',
        returnTo: '/saves/',
      })
    ).response.status,
    200,
  );
  const result = await fixture.request('/api/identity/verify/', { code: '12345678' });
  assert.equal(result.response.status, 200);
  return result;
}
test('email sign-in keeps tokens off the wire, rotates state and signs out only its own session', async () => {
  const fixture = await identityFixture();
  const result = await emailLogin(fixture);
  assert.equal(result.data.returnTo, '/saves/');
  assert.deepEqual(
    fixture.sent.map(({ recipient, code, expiresInMinutes }) => ({
      recipient,
      code,
      expiresInMinutes,
    })),
    [{ recipient: 'owner@example.test', code: '12345678', expiresInMinutes: 5 }],
  );
  assert.ok(!JSON.stringify(result.data).includes('synthetic-access'));
  assert.ok(!JSON.stringify([...fixture.jar]).includes('synthetic-refresh'));
  assert.ok(!JSON.stringify([...fixture.sessions]).includes('synthetic-access'));
  assert.equal((await fixture.request('/api/identity/')).data.email, 'owner@example.test');
  assert.equal(
    (await fixture.request('/api/identity/verify/', { code: '12345678' })).response.status,
    401,
  );
  assert.equal((await fixture.request('/api/identity/logout/', {})).data.signedIn, false);
  assert.equal(fixture.sessions.size, 0);
  assert.equal(fixture.calls.filter((call) => call === 'local-signout').length, 1);
  assert.equal((await fixture.request('/api/identity/')).data.signedIn, false);
  for (const call of fixture.calls.filter(Array.isArray))
    if (call[0] === 'budget') {
      assert.match(call[2], /^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(call).includes('owner@example.test'));
    }
});
test('CSRF, cross-origin, extra privileges and quota failures prevent provider calls', async () => {
  const fixture = await identityFixture();
  await fixture.request('/api/identity/');
  for (const options of [
    { headers: { 'x-agentgrid-csrf': '' } },
    { headers: { origin: 'https://attacker.test' } },
    { headers: { 'sec-fetch-site': 'same-site' } },
    { origin: 'https://attacker.test' },
  ])
    assert.equal(
      (await fixture.request('/api/identity/email/', { email: 'owner@example.test' }, options))
        .response.status,
      403,
    );
  assert.equal(
    (
      await fixture.request('/api/identity/email/', {
        email: 'owner@example.test',
        role: 'administrator',
      })
    ).response.status,
    400,
  );
  fixture.faults.rate = true;
  assert.equal(
    (await fixture.request('/api/identity/email/', { email: 'owner@example.test' })).response
      .status,
    429,
  );
  assert.ok(!fixture.calls.includes('generate'));
  assert.equal(fixture.flows.size, 0);
});
test('email challenges enforce five guesses, expiry, browser binding and verified-address agreement', async () => {
  for (const scenario of ['guesses', 'expiry', 'binding', 'identity']) {
    const fixture = await identityFixture();
    await fixture.request('/api/identity/');
    await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
    if (scenario === 'guesses')
      for (let i = 0; i < 5; i++)
        assert.equal(
          (await fixture.request('/api/identity/verify/', { code: '00000000' })).response.status,
          401,
        );
    if (scenario === 'expiry') fixture.advance(300);
    if (scenario === 'binding') fixture.jar.delete('__Host-agentgrid_challenge');
    if (scenario === 'identity') fixture.faults.wrongEmail = true;
    assert.equal(
      (await fixture.request('/api/identity/verify/', { code: '12345678' })).response.status,
      401,
    );
    assert.equal(fixture.sessions.size, 0);
    if (scenario !== 'identity') assert.ok(!fixture.calls.includes('verify'));
  }
});
test('Google PKCE callbacks are browser-bound, single-use, redirect-safe and consume codes privately', async () => {
  const fixture = await identityFixture();
  await fixture.request('/api/identity/');
  const start = await fixture.request('/api/identity/google/', { returnTo: '//attacker.test/' });
  assert.match(start.data.destination, /^https:\/\/synthetic\.supabase\.co\/auth\/v1\/authorize\?/);
  const cookie = fixture.jar.get('__Host-agentgrid_oauth');
  const result = await fixture.request('/auth/callback/?code=synthetic-google-code');
  assert.equal(result.response.status, 303);
  assert.equal(result.response.headers.get('location'), '/workspace/');
  assert.equal(fixture.sessions.size, 1);
  assert.equal(fixture.jar.has('__Host-agentgrid_oauth'), false);
  fixture.jar.set('__Host-agentgrid_oauth', cookie);
  const replay = await fixture.request('/auth/callback/?code=synthetic-google-code');
  assert.equal(
    replay.response.headers.get('location'),
    '/sign-in/?notice=verification-unavailable',
  );
  assert.equal(
    fixture.calls.filter((call) => Array.isArray(call) && call[0] === 'exchange').length,
    1,
  );
  const stranger = await identityFixture();
  await stranger.request('/api/identity/');
  assert.equal(
    (await stranger.request('/auth/callback/?code=synthetic-google-code')).response.headers.get(
      'location',
    ),
    '/sign-in/?notice=verification-unavailable',
  );
  assert.equal(stranger.sessions.size, 0);
});
test('session reads reverify identity, preserve absolute expiry during refresh and reject provider failure', async () => {
  const fixture = await identityFixture();
  await emailLogin(fixture);
  const [digest, row] = [...fixture.sessions][0],
    expiry = row.expiresAt;
  fixture.advance(3580);
  assert.equal((await fixture.request('/api/identity/')).data.signedIn, true);
  assert.equal(row.revision, 2);
  assert.equal(row.expiresAt, expiry);
  assert.ok(fixture.calls.includes('refresh'));
  fixture.faults.provider = true;
  const failed = await fixture.request('/api/identity/');
  assert.equal(failed.response.status, 503);
  assert.deepEqual(failed.data, { error: 'service-unavailable' });
  fixture.faults.provider = false;
  fixture.faults.identity = true;
  assert.equal((await fixture.request('/api/identity/')).data.signedIn, false);
  fixture.faults.identity = false;
  fixture.jar.set('__Host-agentgrid_session', 'a'.repeat(43));
  const request = new Request(identityOrigin, {
    headers: { cookie: '__Host-agentgrid_session=' + fixture.jar.get('__Host-agentgrid_session') },
  });
  await assert.rejects(authenticatedSession(fixture.runtime, request));
  assert.equal((await fixture.store.loadSession(digest)).expiresAt, expiry);
});
test('server configuration locks stage origins, pilot access and private key pseudonym scope', async () => {
  const config = syntheticConfiguration();
  const environment = {
    AGENTGRID_STAGE: config.stage,
    AGENTGRID_ORIGIN: config.origin,
    NEXT_PUBLIC_SUPABASE_URL: config.supabaseOrigin,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    SUPABASE_SECRET_KEY: config.secretKey,
    RESEND_API_KEY: config.resendKey,
    RESEND_FROM_EMAIL: config.fromEmail,
    AGENTGRID_ENVELOPE_KEYS: JSON.stringify(config.envelopeKeys),
    AGENTGRID_RATE_KEY: config.rateKey,
  };
  assert.deepEqual(authConfiguration(environment), config);
  for (const change of [
    { AGENTGRID_ORIGIN: 'https://attacker.test' },
    { AGENTGRID_PILOT_EMAILS: 'owner@example.test' },
    { AGENTGRID_STAGE: 'preview' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co/' },
    { AGENTGRID_ENVELOPE_KEYS: 'not-json' },
  ])
    assert.throws(() => authConfiguration({ ...environment, ...change }));
  const mac = await createPrivateMac(config.rateKey, config.origin);
  const email = await mac.digest('email', 'owner@example.test');
  assert.match(email, /^[a-f0-9]{64}$/);
  assert.equal(await mac.verify('email', 'owner@example.test', email), true);
  assert.equal(await mac.verify('ip', 'owner@example.test', email), false);
  assert.equal(await mac.verify('email', 'other@example.test', email), false);
  const alternate = await createPrivateMac(config.rateKey, 'https://other.test');
  assert.notEqual(await alternate.digest('email', 'owner@example.test'), email);
  await assert.rejects(createPrivateMac('a'.repeat(43), 'http://insecure.test'));
});

test('concurrent session refresh converges on the winning revision and cannot resurrect logout', async () => {
  const fixture = await identityFixture();
  await emailLogin(fixture);
  fixture.advance(3580);
  let release;
  const completed = new Promise((resolve) => {
    release = resolve;
  });
  const originalReplace = fixture.store.replaceSession;
  fixture.store.replaceSession = async (...args) => {
    const result = await originalReplace(...args);
    release();
    return result;
  };
  let attempts = 0;
  fixture.managed.refresh = async () => {
    attempts++;
    if (attempts === 1) return fixture.session();
    await completed;
    throw new HttpFailure(401, 'not-signed-in');
  };
  const request = new Request(identityOrigin, {
    headers: { cookie: [...fixture.jar].map(([key, value]) => key + '=' + value).join('; ') },
  });
  const [left, right] = await Promise.all([
    authenticatedSession(fixture.runtime, request),
    authenticatedSession(fixture.runtime, request),
  ]);
  assert.equal(left.provider.accessToken, right.provider.accessToken);
  assert.equal([...fixture.sessions.values()][0].revision, 2);
  fixture.advance(3580);
  fixture.managed.refresh = async () => {
    fixture.sessions.clear();
    return fixture.session();
  };
  await assert.rejects(
    authenticatedSession(fixture.runtime, request),
    (error) => error.code === 'not-signed-in',
  );
  assert.equal(fixture.sessions.size, 0);
});
