import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareTextRun, executeTextRun } from '../backend/execution/text-run.ts';
import {
  publicationPreviewDigest,
  publicationIsAuthorized,
  publicationIsDue,
} from '../backend/execution/publication-approval.ts';

const ownerId = '11111111-1111-4111-8111-111111111111';
const versionId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const otherId = '44444444-4444-4444-8444-444444444444';
const specification = JSON.parse(
  readFileSync(
    new URL('../content/agents/transcript-clip-planner/1.0.0.agent.json', import.meta.url),
  ),
);
function fixture(
  generate = async () => ({
    text: 'Synthetic adapter test output; not a real model run.',
    billedMicros: 100,
  }),
) {
  const records = new Map();
  const store = {
    async createOrRead(record) {
      const found = [...records.values()].find(
        (r) => r.ownerId === record.ownerId && r.idempotencyKey === record.idempotencyKey,
      );
      if (found) return structuredClone(found);
      records.set(record.id, structuredClone(record));
      return structuredClone(record);
    },
    async read(owner, id) {
      const r = records.get(id);
      return r?.ownerId === owner ? structuredClone(r) : null;
    },
    async claim(owner, id, digest) {
      const r = records.get(id);
      if (!r || r.ownerId !== owner || r.digest !== digest || r.state !== 'queued') return false;
      r.state = 'running';
      return true;
    },
    async finish(owner, id, state, output) {
      const r = records.get(id);
      // Production RPC must also preserve cancellation during an in-flight request.
      if (r?.ownerId === owner && r.state === 'running') Object.assign(r, { state, output });
    },
  };
  const provider = { identity: 'test-only/model-v1', estimate: () => 1000, generate };
  const actor = { profileId: ownerId, active: true };
  const setup = {
    enabled: true,
    actor,
    request: {
      versionId,
      idempotencyKey: crypto.randomUUID(),
      input: 'Synthetic timestamped transcript.',
    },
    resource: { versionId, published: true, executionApproved: true, specification },
    provider,
    store,
  };
  return {
    setup,
    records,
    execute: (run, overrides = {}) =>
      executeTextRun({
        enabled: true,
        actor,
        provider,
        store,
        runId: run.id,
        approvedDigest: run.digest,
        ...overrides,
      }),
  };
}

test('runtime requires active membership, execution approval and exact published version', async () => {
  for (const overrides of [
    { enabled: false },
    { actor: { profileId: ownerId, active: false } },
    { resource: { versionId, published: false, executionApproved: true, specification } },
    { resource: { versionId, published: true, executionApproved: false, specification } },
    { resource: { versionId: otherId, published: true, executionApproved: true, specification } },
  ]) {
    const f = fixture();
    await assert.rejects(prepareTextRun({ ...f.setup, ...overrides }));
    assert.equal(f.records.size, 0);
  }
  const f = fixture();
  await assert.rejects(
    prepareTextRun({ ...f.setup, request: { ...f.setup.request, input: 'x'.repeat(12_001) } }),
  );
  await assert.rejects(
    prepareTextRun({ ...f.setup, request: { ...f.setup.request, ownerId: otherId } }),
  );
});

test('idempotent preparation rejects changed input and concurrent execution calls provider once', async () => {
  let calls = 0;
  const f = fixture(async (request) => {
    calls++;
    assert.equal(request.maxOutputTokens, 2048);
    assert.equal(request.instructions, specification.execution.instructions);
    assert.equal(request.input, f.setup.request.input);
    return { text: 'Synthetic result.', billedMicros: 100 };
  });
  const run = await prepareTextRun(f.setup);
  assert.equal((await prepareTextRun(f.setup)).id, run.id);
  await assert.rejects(
    prepareTextRun({ ...f.setup, request: { ...f.setup.request, input: 'Changed input.' } }),
    /idempotency_conflict/,
  );
  await Promise.all([f.execute(run), f.execute(run)]);
  assert.equal(calls, 1);
  assert.equal((await f.execute(run)).state, 'succeeded');
  assert.equal(calls, 1);
});

test('other members, changed approvals and changed providers cannot execute a private run', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return { text: 'Synthetic result.', billedMicros: 100 };
  });
  const run = await prepareTextRun(f.setup);
  await assert.rejects(
    f.execute(run, { actor: { profileId: otherId, active: true } }),
    /not_found/,
  );
  await assert.rejects(f.execute(run, { approvedDigest: 'a'.repeat(64) }), /approval_mismatch/);
  await assert.rejects(
    f.execute(run, {
      provider: {
        identity: 'different-provider',
        estimate: () => 1000,
        generate: f.setup.provider.generate,
      },
    }),
    /approval_mismatch/,
  );
  assert.equal(calls, 0);
});

test('unknown provider outcome is sanitized and never retried automatically', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    throw new Error('secret-provider-token');
  });
  const run = await prepareTextRun(f.setup);
  await assert.rejects(f.execute(run), (error) => error.message === 'provider_unavailable');
  assert.equal((await f.execute(run)).state, 'uncertain');
  assert.equal(calls, 1);
  assert.equal(f.records.get(run.id).output, null);
});

test('cancellation while provider is running discards the returned output', async () => {
  const f = fixture(async () => {
    f.records.get(run.id).state = 'cancelled';
    return { text: 'Must not retain cancelled output.', billedMicros: 100 };
  });
  const run = await prepareTextRun(f.setup);
  const result = await f.execute(run);
  assert.equal(result.state, 'cancelled');
  assert.equal(result.output, null);
});

test('social approval is pinned to media, caption, account, revision and schedule', async () => {
  const preview = {
    runId: versionId,
    revision: 1,
    mediaId: otherId,
    mediaSha256: 'b'.repeat(64),
    destinations: [{ platform: 'instagram', connectionId, caption: 'Approved synthetic caption.' }],
    scheduledAt: '2026-10-11T12:00:00Z',
  };
  const options = {
    ownerId,
    preview,
    approval: {
      ownerId,
      digest: await publicationPreviewDigest(preview),
      expiresAt: '2026-10-12T12:00:00Z',
    },
    connections: [{ id: connectionId, ownerId, platform: 'instagram', publishingEnabled: true }],
    now: new Date('2026-10-10T12:00:00Z'),
  };
  assert.equal(await publicationIsAuthorized(options), true);
  assert.equal(await publicationIsDue(options), false);
  assert.equal(await publicationIsDue({ ...options, now: new Date('2026-10-11T12:00:00Z') }), true);
  for (const change of [
    { revision: 2 },
    { mediaSha256: 'c'.repeat(64) },
    { mediaId: connectionId },
    { scheduledAt: '2026-10-11T13:00:00Z' },
    { destinations: [{ ...preview.destinations[0], caption: 'Unapproved caption.' }] },
    { destinations: [{ ...preview.destinations[0], connectionId: otherId }] },
  ])
    assert.equal(
      await publicationIsAuthorized({ ...options, preview: { ...preview, ...change } }),
      false,
    );
  assert.equal(await publicationIsAuthorized({ ...options, ownerId: otherId }), false);
  assert.equal(await publicationIsAuthorized({ ...options, approval: null }), false);
  assert.equal(await publicationIsAuthorized({ ...options, now: new Date('invalid') }), false);
  assert.equal(
    await publicationIsAuthorized({ ...options, now: new Date('2026-10-13T00:00:00Z') }),
    false,
  );
  assert.equal(
    await publicationIsAuthorized({
      ...options,
      connections: [{ ...options.connections[0], publishingEnabled: false }],
    }),
    false,
  );
  assert.equal(
    await publicationIsAuthorized({
      ...options,
      connections: [{ ...options.connections[0], ownerId: otherId }],
    }),
    false,
  );
  assert.equal(
    await publicationIsAuthorized({
      ...options,
      connections: [{ ...options.connections[0], platform: 'linkedin' }],
    }),
    false,
  );
});
