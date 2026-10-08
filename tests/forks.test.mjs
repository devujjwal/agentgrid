import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { forkResources } from '../backend/workspace/forks.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
const sourceId = '30000000-0000-4000-8000-000000000001',
  id = '20000000-0000-4000-8000-000000000001';
const input = { sourceVersionId: sourceId, slug: 'synthetic-fork', name: 'Synthetic Fork' };
const source = {
  sourceVersionId: sourceId,
  resourceId: id,
  slug: 'synthetic-source',
  name: 'Synthetic Source',
  version: '1.0.0',
  creatorName: 'AgentGrid Editorial',
  license: {
    identifier: 'CC-BY-4.0',
    statement: 'Synthetic license for isolated acceptance only.',
    permissions: { use: true, modify: true, redistribute: true, public_fork: true },
  },
};
const receipt = { resourceId: id, sourceVersionId: sourceId, slug: input.slug, created: true };
const fails = (status) => (error) => error.status === status;
function fixture() {
  const config = syntheticConfiguration(),
    calls = [],
    state = { allowed: true, source, receipt, error: null };
  const client = createClient(config.supabaseOrigin, config.publishableKey, {
    accessToken: async () => 'synthetic-member-bearer',
    global: {
      fetch: async (raw, init) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get('apikey'), config.publishableKey);
        assert.equal(headers.get('authorization'), 'Bearer synthetic-member-bearer');
        const name = new URL(String(raw)).pathname.split('/').at(-1);
        calls.push({ name, body: JSON.parse(init.body) });
        return state.error
          ? Response.json(state.error, { status: 400 })
          : Response.json(name === 'agentgrid_fork_source' ? state.source : state.receipt);
      },
    },
  });
  return {
    state,
    calls,
    data: forkResources(client, async () => {
      if (!state.allowed) throw Object.assign(new Error('Member required'), { status: 403 });
      return { id };
    }),
  };
}
test('fork sources use verified membership and reject unavailable, unlicensed or private projections', async () => {
  const { state, calls, data } = fixture();
  assert.deepEqual(await data.forkSource(sourceId), source);
  for (const bad of [
    { ...source, ownerEmail: 'private@example.test' },
    { ...source, sourceVersionId: id },
    {
      ...source,
      license: {
        ...source.license,
        permissions: { ...source.license.permissions, public_fork: false },
      },
    },
  ]) {
    state.source = bad;
    await assert.rejects(data.forkSource(sourceId), fails(503));
  }
  state.source = null;
  await assert.rejects(data.forkSource(sourceId), fails(404));
  await assert.rejects(data.forkSource('bad'), fails(400));
  state.allowed = false;
  const before = calls.length;
  await assert.rejects(data.forkSource(sourceId), fails(403));
  await assert.rejects(data.forkAgent(input), fails(403));
  assert.equal(calls.length, before);
});
test('fork creation sends only identity choices, checks exact receipt and recovers existing forks', async () => {
  const { state, calls, data } = fixture();
  assert.deepEqual(await data.forkAgent(input), receipt);
  assert.deepEqual(calls[0], {
    name: 'agentgrid_fork_agent',
    body: { source_version_id: sourceId, requested_slug: input.slug, requested_name: input.name },
  });
  state.receipt = { ...receipt, created: false };
  assert.equal((await data.forkAgent(input)).created, false);
  for (const bad of [
    null,
    { ...receipt, sourceVersionId: id },
    { ...receipt, slug: 'different-fork' },
    { ...receipt, secret: 'private' },
  ]) {
    state.receipt = bad;
    await assert.rejects(data.forkAgent(input), fails(503));
  }
  for (const bad of [
    { ...input, ownerId: id },
    { ...input, specification: {} },
    { ...input, slug: 'search' },
    { ...input, slug: '../other' },
  ])
    await assert.rejects(data.forkAgent(bad), fails(400));
  state.error = { code: '23505', message: 'PRIVATE occupied slug' };
  await assert.rejects(data.forkAgent(input), fails(409));
});
test('fork HTTP confines source queries and creation to valid session, origin and CSRF', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = workspaceHandler(identity.runtime, () => ({
    forkSource: async (value) => {
      calls.push(['source', value]);
      return source;
    },
    forkAgent: async (value) => {
      calls.push(['fork', value]);
      return receipt;
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
  const path = '/api/workspace/forksource/?sourceVersionId=' + sourceId;
  assert.equal((await handle(request(path))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  for (const query of [
    'sourceVersionId=bad',
    'sourceVersionId=' + sourceId + '&ownerId=' + id,
    'sourceVersionId=' + sourceId + '&sourceVersionId=' + sourceId,
  ])
    assert.equal((await handle(request('/api/workspace/forksource/?' + query))).status, 400);
  assert.equal(
    (await handle(request(path, undefined, undefined, { 'sec-fetch-site': 'cross-site' }))).status,
    403,
  );
  assert.equal((await handle(request('/api/workspace/fork/', input))).status, 403);
  assert.equal(
    (await handle(request('/api/workspace/fork/', { ...input, license: {} }, csrf))).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request('/api/workspace/fork/', input, csrf, { origin: 'https://untrusted.example' }),
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request(path))).status, 200);
  assert.equal((await handle(request('/api/workspace/fork/', input, csrf))).status, 201);
  assert.deepEqual(calls, [
    ['source', sourceId],
    ['fork', input],
  ]);
});
