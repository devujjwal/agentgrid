import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { submissionModerationResources } from '../backend/workspace/submission-moderation.ts';
import { moderationHandler } from '../backend/http/moderation.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
const versionId = '30000000-0000-4000-8000-000000000001',
  resourceId = '20000000-0000-4000-8000-000000000001',
  date = '2026-10-08T00:00:00Z',
  digest = 'a'.repeat(64);
const summary = {
  versionId,
  resourceId,
  slug: 'synthetic-submission',
  name: 'Synthetic Submission',
  version: '1.0.0',
  state: 'pending',
  submittedAt: date,
};
const submission = {
  ...summary,
  reason: '',
  reviewedAt: null,
  contentDigest: digest,
  sourceVersionId: null,
  resourceStatus: 'active',
  authorStatus: 'active',
  authorIsSelf: false,
  specificationText: '{"untrusted":"<script>plain text</script>"}',
  editorialText: '{}',
};
const input = {
  versionId,
  expectedDigest: digest,
  explanation: 'Synthetic review: clarify the missing setup and evidence.',
};
const rejected = { ...submission, state: 'rejected', reason: input.explanation, reviewedAt: date };
const fails = (status) => (error) => error.status === status;
function fixture() {
  const config = syntheticConfiguration(),
    calls = [],
    state = { allowed: true, submission, rows: [summary], rejected, error: null };
  const client = createClient(config.supabaseOrigin, config.publishableKey, {
    accessToken: async () => 'synthetic-staff-bearer',
    global: {
      fetch: async (raw, init) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get('authorization'), 'Bearer synthetic-staff-bearer');
        assert.equal(headers.get('apikey'), config.publishableKey);
        const name = new URL(String(raw)).pathname.split('/').at(-1);
        calls.push({ name, body: JSON.parse(init.body) });
        return state.error
          ? Response.json(state.error, { status: 400 })
          : Response.json(
              name === 'agentgrid_staff_submissions'
                ? state.rows
                : name === 'agentgrid_staff_submission'
                  ? state.submission
                  : state.rejected,
            );
      },
    },
  });
  return {
    state,
    calls,
    data: submissionModerationResources(client, async () => {
      if (!state.allowed) throw Object.assign(new Error('Staff required'), { status: 403 });
    }),
  };
}
test('submission staff projection permits inspecting malformed immutable text without exposing working drafts or identities', async () => {
  const { data, state, calls } = fixture();
  assert.deepEqual(await data.staffSubmission(versionId), submission);
  assert.deepEqual(await data.submissionQueue('pending', 0), {
    state: 'pending',
    offset: 0,
    submissions: [summary],
    hasMore: false,
  });
  for (const bad of [
    { ...submission, ownerEmail: 'private@example.test' },
    { ...submission, versionId: resourceId },
    { ...submission, specificationText: 'a'.repeat(120001) },
    { ...submission, state: 'rejected' },
  ]) {
    state.submission = bad;
    await assert.rejects(data.staffSubmission(versionId), fails(503));
  }
  state.submission = null;
  await assert.rejects(data.staffSubmission(versionId), fails(404));
  for (const rows of [
    [summary, summary],
    [{ ...summary, state: 'approved' }],
    [{ ...summary, editorialText: 'private' }],
  ]) {
    state.rows = rows;
    await assert.rejects(data.submissionQueue('pending', 0), fails(503));
  }
  await assert.rejects(data.submissionQueue('pending', 10000), fails(400));
  state.allowed = false;
  const count = calls.length;
  await assert.rejects(data.staffSubmission(versionId), fails(403));
  await assert.rejects(data.rejectSubmission(input), fails(403));
  assert.equal(calls.length, count);
});
test('rejection confirms the immutable digest and exact response and never treats an uncertain acknowledgement as success', async () => {
  const { data, state, calls } = fixture();
  assert.deepEqual(await data.rejectSubmission(input), rejected);
  assert.deepEqual(calls[0], {
    name: 'agentgrid_reject_submission',
    body: {
      submitted_version_id: versionId,
      expected_digest: digest,
      explanation: input.explanation,
    },
  });
  for (const value of [
    null,
    submission,
    { ...rejected, versionId: resourceId },
    { ...rejected, contentDigest: 'b'.repeat(64) },
    { ...rejected, reason: 'Someone else made a different decision.' },
  ]) {
    state.rejected = value;
    await assert.rejects(data.rejectSubmission(input), fails(503));
  }
  for (const value of [
    { ...input, decision: 'approved' },
    { ...input, moderatorId: resourceId },
    { ...input, expectedDigest: 'bad' },
  ])
    await assert.rejects(data.rejectSubmission(value), fails(400));
  state.error = { code: '40001', message: 'PRIVATE conflict data' };
  await assert.rejects(data.rejectSubmission(input), fails(409));
});
test('submission HTTP enforces exact origin, staff session routing, CSRF and authority-free bounded inputs', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    submissionQueue: async (state, offset) => {
      calls.push(['queue', state, offset]);
      return { state, offset, submissions: [], hasMore: false };
    },
    staffSubmission: async (id) => {
      calls.push(['detail', id]);
      return submission;
    },
    rejectSubmission: async (body) => {
      calls.push(['reject', body]);
      return rejected;
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
  const path = '/api/moderation/submission/?versionId=' + versionId;
  assert.equal((await handle(request(path))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  for (const query of [
    'state=pending&state=approved',
    'state=pending&offset=10000',
    'state=pending&ownerId=' + resourceId,
  ])
    assert.equal((await handle(request('/api/moderation/submissions/?' + query))).status, 400);
  assert.equal((await handle(request(path + '&versionId=' + versionId))).status, 400);
  assert.equal(
    (await handle(request(path, undefined, undefined, { 'sec-fetch-site': 'cross-site' }))).status,
    403,
  );
  assert.equal((await handle(request('/api/moderation/rejection/', input))).status, 403);
  assert.equal(
    (await handle(request('/api/moderation/rejection/', { ...input, approved: true }, csrf)))
      .status,
    400,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request(path))).status, 200);
  assert.equal((await handle(request('/api/moderation/rejection/', input, csrf))).status, 200);
  assert.deepEqual(calls, [
    ['detail', versionId],
    ['reject', input],
  ]);
});

test('submission staff sign-in returns only to the exact private route', async () => {
  const { signInReturnPath } = await import('../src/domain/session.ts');
  const path = '/workspace/moderation/submissions/';
  assert.equal(signInReturnPath(path), path);
  for (const value of [path + '?next=https://example.test', '//example.test' + path, path + '../'])
    assert.equal(signInReturnPath(value), '/workspace/');
});
