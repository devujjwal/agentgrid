import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationFixture } from './fixtures/publication.mjs';
import { prepareReviewedRelease, executeReviewedRelease } from '../backend/publication/release.ts';
import { releaseApprovalResources } from '../backend/workspace/release-approval.ts';
const versionId = '30000000-0000-4000-8000-000000000001',
  requestId = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-08T00:00:00Z');
async function fixture() {
  const source = await publicationFixture();
  const observations = source.hostRuns.map((run, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`,
    versionId,
    contentDigest: source.databaseContentDigest,
    recordedAt: now.toISOString(),
    run,
  }));
  const input = {
    requestId,
    versionId,
    expectedDigest: source.databaseContentDigest,
    expectedResourceRevision: 0,
    expectedReleaseId: null,
    evidenceIds: observations.map((r) => r.id),
    checks: {
      standaloneValue: true,
      sourceAccuracy: true,
      platformEvidence: true,
      privacyAndSecurity: true,
      distributionAndCosts: true,
      reuseRights: true,
    },
    explanation:
      'Synthetic staff decision used to test the authority boundary. No actual host test or public editorial approval is claimed.',
  };
  const approval = {
    ...input,
    resourceId: '20000000-0000-4000-8000-000000000001',
    selfReview: false,
    requestedAt: now.toISOString(),
    expiresAt: '2026-10-15T00:00:00Z',
    state: 'requested',
    decidedAt: null,
  };
  return {
    input,
    approval,
    bundle: {
      approval,
      specification: source.specification,
      editorial: source.editorial,
      observations,
    },
  };
}
test('trusted publication reads persisted evidence, binds ordered records and re-runs the full quality gate', async () => {
  const { bundle } = await fixture();
  assert.equal((await prepareReviewedRelease(bundle, now)).manifest.host_run_sha256.length, 3);
  for (const mutate of [
    (b) => (b.approval.state = 'cancelled'),
    (b) => (b.approval.expiresAt = now.toISOString()),
    (b) => (b.approval.requestedAt = '2026-10-09T00:00:00Z'),
    (b) => b.observations.reverse(),
    (b) => b.observations.pop(),
    (b) => (b.observations[0].versionId = requestId),
    (b) => (b.observations[0].contentDigest = 'b'.repeat(64)),
    (b) => (b.observations[0].run.assertions[0].passed = false),
    (b) => (b.observations[0].run.specification_sha256 = 'b'.repeat(64)),
    (b) => (b.observations[0].run.completed_on = '2020-01-01'),
    (b) => (b.approval.checks.reuseRights = false),
    (b) => (b.specification.license.identifier = 'unselected'),
  ]) {
    const candidate = structuredClone(bundle);
    mutate(candidate);
    await assert.rejects(prepareReviewedRelease(candidate, now));
  }
});
test('publication refuses invalid evidence before writing and verifies the exact final receipt', async () => {
  const { bundle, approval } = await fixture();
  const calls = [];
  const state = {
    bundle,
    receipt: { ...approval, state: 'released', decidedAt: now.toISOString() },
    error: null,
  };
  const client = {
    rpc: async (name, body) => {
      calls.push({ name, body });
      return {
        data: name === 'agentgrid_prepare_release_request' ? state.bundle : state.receipt,
        error: state.error,
      };
    },
  };
  assert.equal((await executeReviewedRelease(client, requestId, now)).receipt.state, 'released');
  assert.equal(calls[1].body.evidence.host_checks_passed, true);
  assert.deepEqual(Object.keys(calls[1].body), ['request_id', 'evidence']);
  for (const receipt of [
    null,
    { ...state.receipt, requestId: versionId },
    { ...state.receipt, expectedDigest: 'b'.repeat(64) },
    { ...state.receipt, state: 'requested' },
  ]) {
    state.receipt = receipt;
    await assert.rejects(executeReviewedRelease(client, requestId, now));
  }
  calls.length = 0;
  state.bundle.observations[0].run.assertions[0].passed = false;
  await assert.rejects(executeReviewedRelease(client, requestId, now));
  assert.equal(calls.length, 1);
});
test('staff request boundary never accepts reviewer, manifest or approval authority and rejects mismatched acknowledgement', async () => {
  const { input, approval } = await fixture();
  const calls = [];
  const state = { allowed: true, response: approval };
  const data = releaseApprovalResources(
    {
      rpc: async (name, body) => {
        calls.push({ name, body });
        return { data: state.response, error: null };
      },
    },
    async () => {
      if (!state.allowed) throw Object.assign(new Error(), { status: 403 });
    },
  );
  assert.deepEqual(await data.requestRelease(input), approval);
  for (const mutate of [
    (v) => (v.reviewerId = requestId),
    (v) => (v.manifest = {}),
    (v) => (v.checks.reuseRights = false),
    (v) => v.evidenceIds.push(v.evidenceIds[0]),
    (v) => (v.explanation += ' sb_secret_' + 'x'.repeat(40)),
  ]) {
    const candidate = structuredClone(input);
    mutate(candidate);
    await assert.rejects(data.requestRelease(candidate), (e) => e.status === 400);
  }
  assert.equal(calls.length, 1);
  state.response = {
    ...approval,
    explanation:
      'A changed returned staff review rationale that differs from the exact submitted and confirmed intention.',
  };
  await assert.rejects(data.requestRelease(input), (e) => e.status === 503);
  state.response = { versionId, approvals: [approval, approval] };
  await assert.rejects(data.releaseApprovals(versionId), (e) => e.status === 503);
  state.response = approval;
  await assert.rejects(data.cancelRelease(requestId), (e) => e.status === 503);
  state.response = { ...approval, state: 'cancelled', decidedAt: now.toISOString() };
  assert.equal((await data.cancelRelease(requestId)).state, 'cancelled');
  state.allowed = false;
  await assert.rejects(data.requestRelease(input), (e) => e.status === 403);
  await assert.rejects(data.releaseApprovals(versionId), (e) => e.status === 403);
  await assert.rejects(data.cancelRelease(requestId), (e) => e.status === 403);
});

test('publication request routes require a session, same-origin CSRF, exact queries and closed review contracts', async () => {
  const { moderationHandler } = await import('../backend/http/moderation.ts');
  const { identityFixture, identityOrigin } = await import('./fixtures/identity.mjs');
  const identity = await identityFixture(),
    { input, approval } = await fixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    releaseApprovals: async (id) => {
      calls.push(id);
      return { versionId: id, approvals: [] };
    },
    requestRelease: async (v) => {
      calls.push(v);
      return approval;
    },
    cancelRelease: async (id) => {
      calls.push(id);
      return { ...approval, state: 'cancelled', decidedAt: now.toISOString() };
    },
  }));
  const request = (path, body, csrf, headers = {}) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...identity.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin: identityOrigin,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-AgentGrid-CSRF': csrf } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const list = '/api/moderation/release-requests/?versionId=' + versionId;
  assert.equal((await handle(request(list))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal((await handle(request(list + '&versionId=' + versionId))).status, 400);
  assert.equal((await handle(request(list + '&approved=true'))).status, 400);
  assert.equal(
    (await handle(request(list, undefined, undefined, { 'sec-fetch-site': 'cross-site' }))).status,
    403,
  );
  assert.equal((await handle(request('/api/moderation/release-request/', input))).status, 403);
  assert.equal(
    (
      await handle(
        request('/api/moderation/release-request/', { ...input, reviewerId: requestId }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handle(request('/api/moderation/release-cancel/', { requestId, versionId }, csrf)))
      .status,
    400,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request(list))).status, 200);
  assert.equal(
    (await handle(request('/api/moderation/release-request/', input, csrf))).status,
    200,
  );
  assert.equal(
    (await handle(request('/api/moderation/release-cancel/', { requestId }, csrf))).status,
    200,
  );
  assert.equal(calls.length, 3);
});

test('uncertain jobs can inspect a historical receipt without preparing or repeating publication', async () => {
  const { inspectReviewedRelease } = await import('../backend/publication/release.ts');
  const { approval } = await fixture(),
    calls = [];
  const state = { receipt: { ...approval, state: 'released', decidedAt: now.toISOString() } };
  const client = {
    rpc: async (name, body) => {
      calls.push({ name, body });
      return { data: state.receipt, error: null };
    },
  };
  assert.equal((await inspectReviewedRelease(client, requestId)).state, 'released');
  assert.deepEqual(calls, [
    { name: 'agentgrid_release_request_status', body: { request_id: requestId } },
  ]);
  state.receipt = { ...state.receipt, requestId: versionId };
  await assert.rejects(inspectReviewedRelease(client, requestId));
  state.receipt = null;
  assert.equal(await inspectReviewedRelease(client, requestId), null);
});
