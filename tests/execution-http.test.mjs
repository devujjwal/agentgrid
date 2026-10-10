import test from 'node:test';
import assert from 'node:assert/strict';
import { executionHandler } from '../backend/http/execution.ts';
import { identityFixture, identityOrigin, syntheticSubject } from './fixtures/identity.mjs';
const owner = crypto.randomUUID();
const member = {
  profile: {
    id: owner,
    username: 'synthetic_owner',
    displayName: 'Synthetic owner',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  },
  roles: [],
  onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
};
test('execution HTTP requires verified active membership and same-origin CSRF and rejects owner/model injection', async () => {
  const fixture = await identityFixture();
  let calls = 0;
  let active = true;
  const transport = async (url) => {
    calls++;
    assert.equal(
      String(url),
      'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_workspace_identity',
    );
    return Response.json(active ? member : { ...member, profile: null });
  };
  const env = { AGENTGRID_EXECUTION_ENABLED: '0' };
  const handler = executionHandler(fixture.runtime, env, transport);
  const make = (path, body, csrf, origin = identityOrigin) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...fixture.jar].map(([key, value]) => key + '=' + value).join('; '),
        origin,
        'content-type': 'application/json',
        ...(csrf ? { 'x-agentgrid-csrf': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await handler(make('/api/execution/'))).status, 401);
  assert.equal(calls, 0);
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  const overview = await handler(make('/api/execution/'));
  assert.equal(overview.status, 200);
  assert.equal((await overview.json()).enabled, false);
  assert.match(overview.headers.get('cache-control'), /no-store/);
  assert.equal((await handler(make('/api/execution/prepare/', {}))).status, 403);
  assert.equal(
    (
      await handler(
        make('/api/execution/prepare/', {}, verified.data.csrf, 'https://untrusted.example'),
      )
    ).status,
    403,
  );
  assert.equal(
    (await handler(make('/api/execution/prepare/', {}, verified.data.csrf))).status,
    503,
  );
  env.AGENTGRID_EXECUTION_ENABLED = '1';
  Object.assign(env, {
    AGENTGRID_STAGE: 'production',
    AGENTGRID_ORIGIN: identityOrigin,
    NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(24),
    SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(24),
  });
  const injected = {
    versionId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    input: 'Synthetic input',
    ownerId: syntheticSubject,
    providerIdentity: 'attacker-model',
  };
  assert.equal(
    (await handler(make('/api/execution/prepare/', injected, verified.data.csrf))).status,
    400,
  );
  assert.equal(
    (
      await handler(
        make(
          '/api/execution/approve/',
          { id: crypto.randomUUID(), digest: 'a'.repeat(64) },
          verified.data.csrf,
        ),
      )
    ).status,
    503,
  );
  active = false;
  assert.equal((await handler(make('/api/execution/'))).status, 403);
});
