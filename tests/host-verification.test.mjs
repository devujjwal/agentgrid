import test from 'node:test';
import { summarizeHostRun } from '../src/domain/host-verification.ts';
import assert from 'node:assert/strict';
import { hostVerificationResources } from '../backend/workspace/host-verification.ts';
import { publicationFixture } from './fixtures/publication.mjs';
const versionId = '30000000-0000-4000-8000-000000000001',
  recordId = '40000000-0000-4000-8000-000000000001';
const fails = (status) => (error) => error.status === status;
async function fixture() {
  const input = await publicationFixture(),
    calls = [];
  const source = {
    contentDigest: input.databaseContentDigest,
    specificationText: JSON.stringify(input.specification),
  };
  const value = {
    recordId,
    versionId,
    expectedDigest: input.databaseContentDigest,
    run: input.hostRuns[0],
  };
  const receipt = {
    id: recordId,
    versionId,
    contentDigest: value.expectedDigest,
    recordedAt: '2026-10-08T00:00:00Z',
    run: value.run,
  };
  const state = { allowed: true, source, response: receipt, error: null };
  const data = hostVerificationResources(
    {
      rpc: async (name, body) => {
        calls.push({ name, body });
        return { data: state.response, error: state.error };
      },
    },
    async () => {
      if (!state.allowed) throw Object.assign(new Error('Denied'), { status: 403 });
    },
    async (id) => {
      assert.equal(id, versionId);
      return state.source;
    },
    () => new Date('2026-10-08T00:00:00Z'),
  );
  return { data, state, calls, value, receipt };
}
test('observations bind the exact server specification and immutable digest, retain failed assertions and validate receipts', async () => {
  const { data, state, calls, value, receipt } = await fixture();
  assert.deepEqual(await data.recordHostRun(value), receipt);
  assert.equal(calls[0].name, 'agentgrid_record_host_run');
  assert.equal(calls[0].body.record_id, recordId);
  const failed = structuredClone(value);
  failed.run.assertions[0].passed = false;
  state.response = { ...receipt, run: failed.run };
  assert.equal((await data.recordHostRun(failed)).run.assertions[0].passed, false);
  for (const response of [
    null,
    { ...receipt, id: versionId },
    { ...receipt, contentDigest: 'b'.repeat(64) },
    {
      ...receipt,
      run: { ...value.run, observed_output: 'A different recorded observation. '.repeat(5) },
    },
  ]) {
    state.response = response;
    await assert.rejects(data.recordHostRun(value), fails(503));
  }
  state.error = { code: '40001', message: 'Private database detail' };
  await assert.rejects(data.recordHostRun(value), fails(409));
});
test('host capture rejects forged authority, wrong platform/content/date, oversized text and possible credentials before mutation', async () => {
  const { data, state, calls, value } = await fixture();
  for (const change of [
    (v) => (v.approved = true),
    (v) => (v.run.platform_slug = 'undeclared'),
    (v) => (v.run.specification_sha256 = 'b'.repeat(64)),
    (v) => (v.run.completed_on = '2026-10-09'),
    (v) => (v.run.completed_on = '2020-01-01'),
    (v) => (v.run.observed_output = 'x'.repeat(16001)),
    (v) => (v.run.input += ' sb_secret_' + 'x'.repeat(40)),
    (v) => (v.run.origin = 'illustrative'),
  ]) {
    const candidate = structuredClone(value);
    change(candidate);
    await assert.rejects(data.recordHostRun(candidate), fails(400));
  }
  assert.equal(calls.length, 0);
  state.source = { ...state.source, contentDigest: 'b'.repeat(64) };
  await assert.rejects(data.recordHostRun(value), fails(409));
  state.allowed = false;
  await assert.rejects(data.recordHostRun(value), fails(403));
  await assert.rejects(data.hostRuns(versionId), fails(403));
  assert.equal(calls.length, 0);
});
test('private evidence lists reject unexpected identity fields, duplicates and mixed versions', async () => {
  const { data, state, receipt } = await fixture();
  state.response = { versionId, runs: [summarizeHostRun(receipt)] };
  assert.equal((await data.hostRuns(versionId)).runs.length, 1);
  for (const response of [
    { versionId, runs: [receipt, receipt] },
    { versionId, runs: [{ ...receipt, recordedByEmail: 'private@example.test' }] },
    { versionId, runs: [{ ...receipt, versionId: recordId }] },
  ]) {
    state.response = response;
    await assert.rejects(data.hostRuns(versionId), fails(503));
  }
});

test('host evidence endpoints enforce session, origin, CSRF, bounded bodies and exact route queries', async () => {
  const { moderationHandler } = await import('../backend/http/moderation.ts');
  const { identityFixture, identityOrigin } = await import('./fixtures/identity.mjs');
  const identity = await identityFixture(),
    fixtureValue = await fixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    hostRuns: async (id) => {
      calls.push(id);
      return { versionId: id, runs: [] };
    },
    recordHostRun: async (value) => {
      calls.push(value);
      return fixtureValue.receipt;
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
  const path = '/api/moderation/host-runs/?versionId=' + versionId;
  assert.equal((await handle(request(path))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal((await handle(request(path + '&versionId=' + versionId))).status, 400);
  assert.equal((await handle(request(path + '&approved=true'))).status, 400);
  assert.equal(
    (await handle(request(path, undefined, undefined, { 'sec-fetch-site': 'cross-site' }))).status,
    403,
  );
  assert.equal(
    (await handle(request('/api/moderation/host-run/', fixtureValue.value))).status,
    403,
  );
  assert.equal(
    (
      await handle(
        request('/api/moderation/host-run/', { ...fixtureValue.value, recordedBy: recordId }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request(
          '/api/moderation/host-run/',
          { ...fixtureValue.value, unbounded: 'x'.repeat(100001) },
          csrf,
        ),
      )
    ).status,
    413,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request(path))).status, 200);
  assert.equal(
    (await handle(request('/api/moderation/host-run/', fixtureValue.value, csrf))).status,
    200,
  );
  assert.equal(calls.length, 2);
});
