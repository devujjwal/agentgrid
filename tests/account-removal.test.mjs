import test from 'node:test';
import assert from 'node:assert/strict';
import { accountResources } from '../backend/workspace/account.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { identityFixture, identityOrigin } from './fixtures/identity.mjs';
const profile = {
  id: '10000000-0000-4000-8000-000000000001',
  username: 'synthetic_owner',
  status: 'active',
};
const input = { profileId: profile.id, username: profile.username, understandsRemoval: true };
test('account removal binds the current profile and accepts only its exact transaction receipt', async () => {
  let calls = 0;
  const client = {
    rpc: async (name, body) => {
      calls++;
      assert.equal(name, 'agentgrid_deactivate_profile');
      assert.deepEqual(body, {
        expected_profile_id: profile.id,
        confirmed_username: profile.username,
      });
      return { data: { profileId: profile.id, deactivated: true }, error: null };
    },
  };
  const data = accountResources(client, async () => profile);
  for (const invalid of [
    { ...input, profileId: '10000000-0000-4000-8000-000000000002' },
    { ...input, username: 'another_owner' },
    { ...input, understandsRemoval: false },
    { ...input, role: 'administrator' },
  ])
    await assert.rejects(data.deactivateAccount(invalid));
  assert.equal(calls, 0);
  assert.equal((await data.deactivateAccount(input)).deactivated, true);
  assert.equal(calls, 1);
  for (const value of [
    null,
    { profileId: '10000000-0000-4000-8000-000000000002', deactivated: true },
    { profileId: profile.id, deactivated: false },
  ])
    await assert.rejects(
      accountResources(
        { rpc: async () => ({ data: value, error: null }) },
        async () => profile,
      ).deactivateAccount(input),
    );
  await assert.rejects(
    accountResources(client, async () => {
      throw new Error('Membership revoked');
    }).deactivateAccount(input),
  );
  assert.equal(calls, 1);
});
test('account removal HTTP enforces current CSRF, verified session, explicit consent and bounded closed input', async () => {
  const fixture = await identityFixture();
  let calls = 0;
  const handler = workspaceHandler(fixture.runtime, () => ({
    deactivateAccount: async (body) => {
      assert.deepEqual(body, input);
      calls++;
      return { profileId: profile.id, deactivated: true };
    },
  }));
  const request = (body, csrf, path = '/api/workspace/deactivate/') =>
    new Request(identityOrigin + path, {
      method: 'POST',
      headers: {
        origin: identityOrigin,
        'content-type': 'application/json',
        cookie: [...fixture.jar].map(([k, v]) => k + '=' + v).join('; '),
        ...(csrf ? { 'x-agentgrid-csrf': csrf } : {}),
      },
      body: JSON.stringify(body),
    });
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  assert.equal((await handler(request(input))).status, 403);
  for (const body of [
    { ...input, understandsRemoval: false },
    { ...input, extra: 'authority' },
    { ...input, username: 'x'.repeat(1200) },
  ])
    assert.equal((await handler(request(body, verified.data.csrf))).status >= 400, true);
  assert.equal(
    (await handler(request(input, verified.data.csrf, '/api/workspace/deactivate/?force=1')))
      .status,
    400,
  );
  assert.equal(calls, 0);
  const response = await handler(request(input, verified.data.csrf));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(calls, 1);
  fixture.jar.clear();
  assert.ok((await handler(request(input, verified.data.csrf))).status >= 400);
  assert.equal(calls, 1);
});
