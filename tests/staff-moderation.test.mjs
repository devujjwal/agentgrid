import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { moderationResources } from '../backend/workspace/moderation.ts';
import { moderationHandler } from '../backend/http/moderation.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';

const id = '40000000-0000-4000-8000-000000000001';
const summary = {
  id,
  resourceId: '20000000-0000-4000-8000-000000000001',
  resourceSlug: 'synthetic-resource',
  title: 'Synthetic staff acceptance',
  revision: 1,
  decisionRevision: 0,
  createdAt: '2026-10-07T00:00:00Z',
  state: 'pending',
};
const detail = {
  ...summary,
  resourceAvailable: true,
  authorActive: true,
  authorIsSelf: false,
  usedVersionId: '30000000-0000-4000-8000-000000000001',
  version: '1.0.0',
  rating: 4,
  body: 'Synthetic feedback for checking moderator access and conflict recovery. This is not real community activity.',
  experience: 'Synthetic local test context for staff decisions only.',
  reason: '',
  reviewedAt: null,
  withdrawnAt: null,
  updatedAt: summary.createdAt,
};
const decision = {
  reviewId: id,
  expectedRevision: 1,
  expectedDecisionRevision: 0,
  decision: 'published',
  explanation: 'Synthetic moderation decision for local testing only.',
};
const confirmed = {
  ...detail,
  state: 'published',
  decisionRevision: 1,
  reason: decision.explanation,
  reviewedAt: summary.createdAt,
};
const fails = (status) => (error) => error.status === status;
function fixture() {
  const config = syntheticConfiguration(),
    calls = [];
  const state = {
    identity: { profile: { status: 'active' }, roles: ['moderator'] },
    queue: [summary],
    detail,
    confirmed,
    error: null,
  };
  const client = createClient(config.supabaseOrigin, config.publishableKey, {
    accessToken: async () => 'synthetic-staff-bearer',
    global: {
      fetch: async (raw, init) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get('authorization'), 'Bearer synthetic-staff-bearer');
        assert.equal(headers.get('apikey'), config.publishableKey);
        const name = new URL(String(raw)).pathname.split('/').at(-1);
        calls.push({ name, body: JSON.parse(init.body) });
        if (state.error) return Response.json(state.error, { status: 400 });
        return Response.json(
          name === 'agentgrid_staff_reviews'
            ? state.queue
            : name === 'agentgrid_staff_review'
              ? state.detail
              : state.confirmed,
        );
      },
    },
  });
  return { calls, state, data: moderationResources(client, async () => state.identity) };
}
test('staff requires active app-specific roles on every operation and verified user authority', async () => {
  const { data, state, calls } = fixture();
  for (const identity of [
    { profile: null, roles: ['administrator'] },
    { profile: { status: 'suspended' }, roles: ['moderator'] },
    { profile: { status: 'active' }, roles: [] },
  ]) {
    state.identity = identity;
    await assert.rejects(data.reviewQueue('pending', 0), fails(403));
    await assert.rejects(data.staffReview(id), fails(403));
    await assert.rejects(data.decideReview(decision), fails(403));
  }
  assert.equal(calls.length, 0);
  state.identity = { profile: { status: 'active' }, roles: ['administrator'] };
  assert.deepEqual(await data.staffReview(id), detail);
  assert.equal(calls[0].name, 'agentgrid_staff_review');
});
test('staff projections reject private field leakage, mixed queues and mismatched details', async () => {
  const { data, state } = fixture();
  assert.equal((await data.reviewQueue('pending', 0)).reviews.length, 1);
  for (const bad of [
    [{ ...summary, authorEmail: 'private@example.test' }],
    [summary, summary],
    [{ ...summary, state: 'published' }],
  ]) {
    state.queue = bad;
    await assert.rejects(data.reviewQueue('pending', 0), fails(503));
  }
  state.queue = Array.from({ length: 21 }, (_, i) => ({
    ...summary,
    id: '40000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
  }));
  assert.equal((await data.reviewQueue('pending', 20)).hasMore, true);
  assert.equal((await data.reviewQueue('pending', 20)).reviews.length, 20);
  for (const bad of [
    { ...detail, id: summary.resourceId },
    { ...detail, staffEmail: 'private@example.test' },
    { ...detail, state: 'published' },
  ]) {
    state.detail = bad;
    await assert.rejects(data.staffReview(id), fails(503));
  }
  state.detail = null;
  await assert.rejects(data.staffReview(id), fails(404));
  await assert.rejects(data.reviewQueue('pending', -1), fails(400));
});
test('decision acknowledgement is exact and uncertain responses never imply a failed write', async () => {
  const { data, state, calls } = fixture();
  assert.deepEqual(await data.decideReview(decision), confirmed);
  assert.deepEqual(calls[0], {
    name: 'agentgrid_decide_review',
    body: {
      review_resource_id: id,
      expected_revision: 1,
      expected_decision_revision: 0,
      decision: 'published',
      explanation: decision.explanation,
    },
  });
  for (const bad of [
    null,
    { ...confirmed, decisionRevision: 2 },
    { ...confirmed, revision: 2 },
    { ...confirmed, reason: 'Another moderator changed the explanation.' },
    { ...confirmed, state: 'hidden' },
  ]) {
    state.confirmed = bad;
    await assert.rejects(data.decideReview(decision), fails(503));
  }
  const before = calls.length;
  await assert.rejects(data.decideReview({ ...decision, moderatorId: id }), fails(400));
  assert.equal(calls.length, before);
  for (const [code, status] of [
    ['40001', 409],
    ['42501', 403],
    ['P0001', 429],
    ['XX000', 503],
  ]) {
    state.error = { code, message: 'PRIVATE provider detail' };
    await assert.rejects(
      data.decideReview(decision),
      (e) => e.status === status && !e.message.includes('PRIVATE'),
    );
  }
});
test('moderation HTTP enforces sessions, exact origin, CSRF, bounded queries and strict authority-free inputs', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    reviewQueue: async (state, offset) => {
      calls.push(['queue', state, offset]);
      return { state, offset, reviews: [], hasMore: false };
    },
    staffReview: async (id) => {
      calls.push(['detail', id]);
      return detail;
    },
    decideReview: async (value) => {
      calls.push(['decision', value]);
      return confirmed;
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
  assert.equal((await handle(request('/api/moderation/reviews/?state=pending'))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal((await handle(request('/api/moderation/decision/', decision))).status, 403);
  assert.equal(
    (
      await handle(
        request('/api/moderation/decision/', decision, csrf, { origin: 'https://attacker.test' }),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handle(
        request('/api/moderation/decision/', { ...decision, role: 'administrator' }, csrf),
      )
    ).status,
    400,
  );
  for (const query of [
    'state=pending&state=hidden',
    'state=withdrawn',
    'state=pending&offset=-1',
    'state=pending&offset=10000',
    'state=pending&authorId=' + id,
  ])
    assert.equal((await handle(request('/api/moderation/reviews/?' + query))).status, 400);
  assert.equal(
    (await handle(request('/api/moderation/review/?reviewId=' + id + '&reviewId=' + id))).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request('/api/moderation/reviews/?state=pending', undefined, undefined, {
          'sec-fetch-site': 'cross-site',
        }),
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  const response = await handle(request('/api/moderation/reviews/?state=pending&offset=20'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.equal((await handle(request('/api/moderation/decision/', decision, csrf))).status, 200);
  assert.deepEqual(calls, [
    ['queue', 'pending', 20],
    ['decision', decision],
  ]);
});
