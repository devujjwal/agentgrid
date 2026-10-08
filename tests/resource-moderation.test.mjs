import test from 'node:test';
import assert from 'node:assert/strict';
import { resourceModerationResources } from '../backend/workspace/resource-moderation.ts';
import { moderationHandler } from '../backend/http/moderation.ts';
import { identityFixture, identityOrigin } from './fixtures/identity.mjs';
const id = '20000000-0000-4000-8000-000000000001';
const resource = {
  resourceId: id,
  slug: 'synthetic-agent',
  status: 'active',
  revision: 0,
  reason: '',
  moderatedAt: null,
  ownerIsSelf: false,
  ownerStatus: 'active',
  releasedVersionId: null,
  releasedVersion: null,
};
const input = {
  resourceId: id,
  expectedRevision: 0,
  expectedReleaseId: null,
  decision: 'blocked',
  explanation: 'Synthetic safety review requires a temporary restriction.',
};
const saved = {
  ...resource,
  status: 'blocked',
  revision: 1,
  reason: input.explanation,
  moderatedAt: '2026-10-08T00:00:00Z',
};
const fails = (status) => (error) => error.status === status;
test('resource moderation binds exact revision and release and refuses uncertain receipts or authority fields', async () => {
  let row = resource,
    allowed = true,
    error = null;
  const calls = [];
  const data = resourceModerationResources(
    {
      rpc: async (name, body) => {
        calls.push({ name, body });
        return { data: row, error };
      },
    },
    async () => {
      if (!allowed) throw Object.assign(new Error('Denied'), { status: 403 });
    },
  );
  assert.deepEqual(await data.staffResource(id), resource);
  row = saved;
  assert.deepEqual(await data.decideResource(input), saved);
  assert.deepEqual(calls.at(-1), {
    name: 'agentgrid_decide_resource',
    body: {
      resource_id: id,
      expected_revision: 0,
      expected_release_id: null,
      decision: 'blocked',
      explanation: input.explanation,
    },
  });
  for (const bad of [
    null,
    resource,
    { ...saved, revision: 2 },
    { ...saved, releasedVersionId: id, releasedVersion: '1.0.0' },
    { ...saved, reason: 'A different staff decision was saved.' },
    { ...saved, moderatedAt: null },
    { ...saved, ownerIsSelf: true },
    { ...saved, privateDraft: {} },
  ]) {
    row = bad;
    await assert.rejects(data.decideResource(input), fails(503));
  }
  row = null;
  await assert.rejects(data.staffResource(id), fails(404));
  row = { ...resource, resourceId: '20000000-0000-4000-8000-000000000002' };
  await assert.rejects(data.staffResource(id), fails(503));
  for (const bad of [
    { ...input, moderatorId: id },
    { ...input, expectedRevision: -1 },
    { ...input, decision: 'archived' },
    { ...input, explanation: 'short' },
  ])
    await assert.rejects(data.decideResource(bad), fails(400));
  error = { code: '40001', message: 'Private provider details' };
  await assert.rejects(data.decideResource(input), fails(409));
  allowed = false;
  const count = calls.length;
  await assert.rejects(data.staffResource(id), fails(403));
  await assert.rejects(data.decideResource(input), fails(403));
  assert.equal(calls.length, count);
});
test('resource HTTP boundary requires session, CSRF, exact origin and bounded authority-free payloads', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    staffResource: async (id) => {
      calls.push(id);
      return resource;
    },
    decideResource: async (value) => {
      calls.push(value);
      return saved;
    },
  }));
  const request = (path, body, csrf, extra = {}) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...identity.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin: identityOrigin,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-AgentGrid-CSRF': csrf } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const path = '/api/moderation/resource/?resourceId=' + id;
  assert.equal((await handle(request(path))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  for (const suffix of ['&resourceId=' + id, '&ownerId=' + id])
    assert.equal((await handle(request(path + suffix))).status, 400);
  assert.equal(
    (await handle(request(path, undefined, undefined, { 'sec-fetch-site': 'cross-site' }))).status,
    403,
  );
  assert.equal((await handle(request('/api/moderation/resource-decision/', input))).status, 403);
  assert.equal(
    (
      await handle(
        request('/api/moderation/resource-decision/', { ...input, role: 'administrator' }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request(
          '/api/moderation/resource-decision/',
          { ...input, explanation: 'x'.repeat(13000) },
          csrf,
        ),
      )
    ).status,
    413,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request(path))).status, 200);
  assert.equal(
    (await handle(request('/api/moderation/resource-decision/', input, csrf))).status,
    200,
  );
  assert.deepEqual(calls, [id, input]);
});

test('resource sign-in returns only to a single validated internal resource reference', async () => {
  const { signInReturnPath } = await import('../src/domain/session.ts');
  const path = '/workspace/moderation/agent/?resourceId=' + id;
  assert.equal(signInReturnPath(path), path);
  for (const bad of [
    path + '&resourceId=' + id,
    path + '&next=https://example.test',
    '//example.test' + path,
    path.replace(id, 'not-a-uuid'),
  ])
    assert.equal(signInReturnPath(bad), '/workspace/');
});
