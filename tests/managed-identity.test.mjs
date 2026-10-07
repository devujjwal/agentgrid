import test from 'node:test';
import assert from 'node:assert/strict';
import { managedIdentity } from '../backend/auth/managed.ts';
import { identityStore } from '../backend/auth/store.ts';
import { syntheticConfiguration, syntheticSubject } from './fixtures/identity.mjs';

const configuration = syntheticConfiguration();
const user = {
  id: syntheticSubject,
  aud: 'authenticated',
  email: 'owner@example.test',
  email_confirmed_at: '2026-10-07T00:00:00Z',
  created_at: '2026-10-07T00:00:00Z',
  app_metadata: {},
  user_metadata: { role: 'administrator' },
  identities: [{ provider: 'google' }],
};
const session = {
  access_token: 'synthetic-access-token-for-adapter-only',
  refresh_token: 'synthetic-refresh-token-for-adapter-only',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user,
};
test('pinned managed SDK uses PKCE, server verification, custom email generation and local-only logout', async () => {
  const requests = [];
  const transport = async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init.headers);
    assert.equal(url.origin, configuration.supabaseOrigin);
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal);
    const body = init.body ? JSON.parse(init.body) : null;
    requests.push({ url, headers, body });
    if (url.pathname === '/auth/v1/admin/generate_link')
      return Response.json({
        action_link: 'https://synthetic.supabase.co/auth/v1/verify',
        email_otp: '12345678',
        hashed_token: 'a'.repeat(64),
        redirect_to: configuration.origin,
        verification_type: 'magiclink',
        ...user,
      });
    if (url.pathname === '/auth/v1/user') return Response.json(user);
    if (url.pathname === '/auth/v1/logout') return new Response(null, { status: 204 });
    if (url.pathname === '/auth/v1/verify' || url.pathname === '/auth/v1/token')
      return Response.json(session);
    throw new Error('Unexpected managed endpoint');
  };
  const managed = managedIdentity(configuration, transport);
  const challenge = await managed.emailChallenge('owner@example.test');
  assert.deepEqual(challenge, { code: '12345678', tokenHash: 'a'.repeat(64) });
  const issued = await managed.verifyEmail(challenge.tokenHash);
  assert.deepEqual(await managed.verify(issued), {
    id: syntheticSubject,
    email: 'owner@example.test',
  });
  const google = await managed.startGoogle(),
    authorize = new URL(google.destination);
  assert.equal(authorize.searchParams.get('provider'), 'google');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.equal(authorize.searchParams.get('redirect_to'), configuration.origin + '/auth/callback/');
  const pkceVerifier = JSON.parse(google.verifier).split('/')[0];
  const expected = Buffer.from(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pkceVerifier)),
  ).toString('base64url');
  assert.equal(authorize.searchParams.get('code_challenge'), expected);
  await managed.finishGoogle('synthetic-google-code', google.verifier);
  await managed.refresh(issued.refreshToken);
  await managed.signOut(issued);
  const verify = requests.find(({ url }) => url.pathname === '/auth/v1/verify');
  assert.deepEqual(verify.body, {
    type: 'magiclink',
    token_hash: challenge.tokenHash,
    gotrue_meta_security: {},
  });
  assert.equal(verify.headers.get('apikey'), configuration.publishableKey);
  const exchange = requests.find(({ url }) => url.searchParams.get('grant_type') === 'pkce');
  assert.equal(exchange.body.code_verifier, pkceVerifier);
  const logout = requests.find(({ url }) => url.pathname === '/auth/v1/logout');
  assert.equal(logout.url.searchParams.get('scope'), 'local');
  assert.equal(logout.headers.get('authorization'), 'Bearer ' + issued.accessToken);
  assert.equal(
    requests.filter(({ url }) => url.pathname === '/auth/v1/admin/generate_link').length,
    1,
  );
  assert.ok(requests.every(({ url }) => url.pathname.startsWith('/auth/v1/')));
});
test('managed verification refuses unconfirmed/mismatched identity and treats outages as unavailable', async () => {
  for (const scenario of ['unconfirmed', 'mismatched', 'outage', 'invalid']) {
    const transport = async () =>
      scenario === 'outage'
        ? Response.json({ message: 'Synthetic private failure' }, { status: 503 })
        : scenario === 'invalid'
          ? Response.json({ message: 'Synthetic private denial' }, { status: 401 })
          : Response.json({
              ...user,
              ...(scenario === 'unconfirmed'
                ? { email_confirmed_at: null }
                : { id: 'b87eb15c-36eb-426f-97fe-c00000000002' }),
            });
    const managed = managedIdentity(configuration, transport);
    await assert.rejects(
      managed.verify({
        subject: syntheticSubject,
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
      }),
      (error) =>
        error.status === (scenario === 'outage' ? 503 : 401) &&
        !error.message.includes('Synthetic private'),
    );
  }
});
test('identity persistence restricts service-role traffic to fixed owned RPCs and rejects malformed projections', async () => {
  const requests = [];
  let malformed = false;
  const transport = async (input, init) => {
    const url = new URL(String(input));
    requests.push(url.pathname);
    assert.equal(new Headers(init.headers).get('apikey'), configuration.secretKey);
    assert.equal(init.redirect, 'error');
    if (url.pathname.endsWith('/agentgrid_auth_session_load'))
      return Response.json(
        malformed
          ? [
              {
                encrypted_state: 'synthetic',
                revision: 1,
                expires_at: '2026-10-08T00:00:00Z',
                private_extra: 'must reject',
              },
            ]
          : [],
      );
    if (url.pathname.endsWith('/agentgrid_auth_flow_consume')) return Response.json(null);
    return Response.json(true);
  };
  const store = identityStore(configuration, transport),
    hash = 'a'.repeat(64);
  assert.equal(await store.allow('email', hash, hash), true);
  await store.createFlow(hash, 'email', hash, hash, 'synthetic-sealed-state');
  assert.equal(await store.consumeFlow(hash, 'email', hash, hash), null);
  assert.equal(await store.createSession(hash, hash, 'synthetic-sealed-state'), true);
  assert.equal(await store.loadSession(hash), null);
  assert.equal(await store.replaceSession(hash, 1, 'synthetic-next-state'), true);
  await store.revokeSession(hash);
  malformed = true;
  await assert.rejects(store.loadSession(hash));
  assert.ok(requests.every((path) => path.startsWith('/rest/v1/rpc/agentgrid_auth_')));
});
