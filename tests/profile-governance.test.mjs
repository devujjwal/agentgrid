import test from 'node:test';
import assert from 'node:assert/strict';
import { profileGovernance } from '../backend/workspace/profile-governance.ts';
import { administrationHandler } from '../backend/http/administration.ts';
import { availableProfileDecisions } from '../src/domain/profile-governance.ts';
import { identityFixture, identityOrigin } from './fixtures/identity.mjs';
const profile = {
  id: '10000000-0000-4000-8000-000000000001',
  username: 'synthetic_owner',
  displayName: 'Synthetic owner',
  bio: '',
  website: null,
  visibility: 'private',
  status: 'active',
  roles: [],
  revision: 1,
  linked: true,
  isSelf: false,
};
const decision = {
  profileId: profile.id,
  expectedRevision: 1,
  decision: 'suspend',
  explanation: 'Synthetic decision evidence for acceptance only.',
};
test('administrator authority is read afresh and closed projections exclude shared-identity data', async () => {
  let roles = ['moderator'],
    calls = 0,
    value = profile;
  const service = profileGovernance(
    {
      rpc: async (name, body) => {
        calls++;
        assert.equal(name, 'agentgrid_admin_profile');
        assert.deepEqual(body, { requested_username: profile.username });
        return { data: value, error: null };
      },
    },
    async () => ({ profile, roles }),
  );
  await assert.rejects(service.profile(profile.username));
  assert.equal(calls, 0);
  roles = ['administrator'];
  assert.deepEqual(await service.profile(profile.username), profile);
  for (const invalid of [
    { ...profile, email: 'private@example.test' },
    { ...profile, username: 'different_owner' },
    { ...profile, roles: ['administrator', 'administrator'] },
  ]) {
    value = invalid;
    await assert.rejects(service.profile(profile.username));
  }
  roles = [];
  const before = calls;
  await assert.rejects(service.profile(profile.username));
  assert.equal(calls, before);
});
test('decisions bind target and revision and reject mismatched or false-success receipts', async () => {
  let value = { ...profile, status: 'suspended', revision: 2 },
    calls = 0;
  const service = profileGovernance(
    {
      rpc: async (name, body) => {
        calls++;
        assert.equal(name, 'agentgrid_decide_profile');
        assert.deepEqual(body, {
          target_profile_id: profile.id,
          expected_revision: 1,
          decision: 'suspend',
          decision_reason: decision.explanation,
        });
        return { data: value, error: null };
      },
    },
    async () => ({ profile, roles: ['administrator'] }),
  );
  for (const invalid of [
    { ...decision, actor: profile.id },
    { ...decision, expectedRevision: 0 },
    { ...decision, explanation: 'too short' },
  ])
    await assert.rejects(service.decide(invalid));
  assert.equal(calls, 0);
  assert.equal((await service.decide(decision)).status, 'suspended');
  for (const invalid of [
    profile,
    { ...profile, status: 'suspended', revision: 3 },
    { ...profile, status: 'active', revision: 2 },
    { ...value, id: '10000000-0000-4000-8000-000000000002' },
  ]) {
    value = invalid;
    await assert.rejects(service.decide(decision));
  }
  assert.deepEqual(availableProfileDecisions({ ...profile, status: 'suspended' }), ['restore']);
  assert.deepEqual(availableProfileDecisions({ ...profile, linked: false }), []);
  assert.ok(
    availableProfileDecisions({ ...profile, roles: ['administrator'] }).includes(
      'revoke-administrator',
    ),
  );
});
test('administrator HTTP boundary enforces session, CSRF, closed bodies and exact lookup query', async () => {
  const fixture = await identityFixture();
  let calls = 0;
  const handler = administrationHandler(fixture.runtime, () => ({
    profile: async () => {
      calls++;
      return profile;
    },
    decide: async () => {
      calls++;
      return { ...profile, status: 'suspended', revision: 2 };
    },
  }));
  const request = (path, body, csrf) =>
    new Request(identityOrigin + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: identityOrigin,
        'content-type': 'application/json',
        cookie: [...fixture.jar].map(([k, v]) => k + '=' + v).join('; '),
        ...(csrf ? { 'x-agentgrid-csrf': csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await handler(request('/api/admin/profile/?username=synthetic_owner'))).status,
    401,
  );
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  for (const path of [
    '/api/admin/profile/?username=synthetic_owner&username=other',
    '/api/admin/profile/?username=synthetic_owner&email=private',
    '/api/admin/profile/?username=%25',
    '/api/admin/profile/',
  ])
    assert.equal((await handler(request(path))).status, 400);
  assert.equal((await handler(request('/api/admin/profile-decision/', decision))).status, 403);
  assert.equal(
    (
      await handler(
        request('/api/admin/profile-decision/', { ...decision, role: 'owner' }, verified.data.csrf),
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
  const read = await handler(request('/api/admin/profile/?username=synthetic_owner'));
  assert.equal(read.status, 200);
  assert.equal(read.headers.get('cache-control'), 'private, no-store');
  assert.equal(
    (await handler(request('/api/admin/profile-decision/', decision, verified.data.csrf))).status,
    200,
  );
  assert.equal(calls, 2);
  fixture.jar.clear();
  assert.equal(
    (await handler(request('/api/admin/profile/?username=synthetic_owner'))).status,
    401,
  );
});

test('browser service permits only exact administrator endpoints and validates receipts', async (t) => {
  const { communityRequest } = await import('../src/services/community.ts');
  const { AdminProfileSchema } = await import('../src/domain/profile-governance.ts');
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    calls.push({ path, options });
    return Response.json(profile);
  });
  assert.deepEqual(
    await communityRequest('/api/admin/profile/?username=synthetic_owner', AdminProfileSchema),
    profile,
  );
  await communityRequest('/api/admin/profile-decision/', AdminProfileSchema, {
    csrf: 'synthetic-csrf',
    body: decision,
  });
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.headers['X-AgentGrid-CSRF'], 'synthetic-csrf');
  for (const path of [
    '/api/admin/profile/?username=synthetic_owner&other=1',
    '/api/admin/profile/?username=owner%40example.test',
    '/api/admin/profile-decision/?username=synthetic_owner',
    'https://outside.example/api/admin/profile-decision/',
  ])
    await assert.rejects(communityRequest(path, AdminProfileSchema), { code: 'request-refused' });
  assert.equal(calls.length, 2);
});
