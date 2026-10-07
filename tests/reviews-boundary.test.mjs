import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { reviewResources } from '../backend/workspace/reviews.ts';
import { publicReviewData } from '../backend/community/reviews.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { publicCommunityHandler } from '../backend/http/community.ts';
import { publicCommunityConfiguration } from '../backend/community/configuration.ts';

const resourceId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const reviewId = '40000000-0000-4000-8000-000000000001';
const date = '2026-10-07T00:00:00Z';
const input = {
  resourceId,
  usedVersionId: versionId,
  rating: 4,
  title: 'Synthetic review acceptance',
  body: 'A clearly synthetic review describes the actual local workflow, useful output, and limitations in enough detail.',
  experience: 'Synthetic workflow experience used only for acceptance testing.',
  expectedRevision: 0,
};
const owned = {
  id: reviewId,
  resourceId,
  usedVersionId: versionId,
  version: '1.0.0',
  rating: input.rating,
  title: input.title,
  body: input.body,
  experience: input.experience,
  revision: 1,
  createdAt: date,
  updatedAt: date,
  state: 'pending',
  reason: '',
  reviewedAt: null,
  withdrawnAt: null,
};
const publicRow = {
  id: reviewId,
  usedVersionId: versionId,
  version: '1.0.0',
  rating: 4,
  title: input.title,
  body: input.body,
  experience: input.experience,
  createdAt: date,
  updatedAt: date,
  author: { name: 'Community member', username: null },
};
const fails = (status) => (error) => error.status === status;
function fixture() {
  const configuration = syntheticConfiguration(),
    calls = [];
  const state = { active: true, owned, write: reviewId, error: null };
  const client = createClient(configuration.supabaseOrigin, configuration.publishableKey, {
    accessToken: async () => 'synthetic-review-bearer',
    global: {
      fetch: async (raw, init) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get('apikey'), configuration.publishableKey);
        assert.equal(headers.get('authorization'), 'Bearer synthetic-review-bearer');
        const name = new URL(String(raw)).pathname.split('/').at(-1),
          body = JSON.parse(init.body);
        calls.push({ name, body });
        if (state.error) return Response.json(state.error, { status: 400 });
        if (name === 'agentgrid_owned_review') return Response.json(state.owned);
        if (name === 'agentgrid_write_review' || name === 'agentgrid_withdraw_review')
          return Response.json(state.write);
        if (name === 'agentgrid_review_context') return Response.json(state.context);
        throw new Error('Unexpected synthetic transport');
      },
    },
  });
  return {
    state,
    calls,
    data: reviewResources(client, async () => {
      if (!state.active) throw Object.assign(new Error('Member required'), { status: 403 });
    }),
  };
}
test('owned reviews are strict, resource-bound and use verified bearer authority with no staff override', async () => {
  const { state, data, calls } = fixture();
  assert.deepEqual(await data.review(resourceId), owned);
  assert.deepEqual(calls.at(-1), {
    name: 'agentgrid_owned_review',
    body: { resource_id: resourceId },
  });
  state.owned = null;
  assert.equal(await data.review(resourceId), null);
  for (const malformed of [
    { ...owned, resourceId: reviewId },
    { ...owned, authorEmail: 'private@example.test' },
    { ...owned, state: 'published' },
    { ...owned, reviewedAt: date },
    { ...owned, reason: 'Unreviewed private notes' },
  ]) {
    state.owned = malformed;
    await assert.rejects(data.review(resourceId), fails(503));
  }
  state.active = false;
  const count = calls.length;
  await assert.rejects(data.review(resourceId), fails(403));
  assert.equal(calls.length, count);
});
test('review writes confirm exact self-owned content/revision and preserve live moderation without false publication', async () => {
  const { state, data, calls } = fixture();
  assert.deepEqual(await data.writeReview(input), owned);
  assert.deepEqual(calls.find((c) => c.name === 'agentgrid_write_review').body, {
    resource_id: resourceId,
    used_version: versionId,
    requested_rating: 4,
    requested_title: input.title,
    requested_body: input.body,
    experience: input.experience,
    expected_revision: 0,
  });
  const published = {
    ...owned,
    state: 'published',
    reason: 'Synthetic reviewer decision raced the acknowledgement.',
    reviewedAt: date,
  };
  state.owned = published;
  assert.deepEqual(await data.writeReview(input), published);
  for (const mismatched of [
    null,
    { ...owned, id: versionId },
    { ...owned, usedVersionId: resourceId },
    { ...owned, rating: 3 },
    { ...owned, title: 'Wrong synthetic title' },
    { ...owned, body: input.body + ' different' },
    { ...owned, experience: input.experience + ' different' },
    { ...owned, revision: 2 },
  ]) {
    state.owned = mismatched;
    await assert.rejects(data.writeReview(input), fails(503));
  }
  const before = calls.length;
  await assert.rejects(data.writeReview({ ...input, authorId: reviewId }), fails(400));
  assert.equal(calls.length, before);
  for (const [code, status] of [
    ['42501', 403],
    ['40001', 409],
    ['P0001', 429],
    ['XX000', 503],
  ]) {
    state.error = { code, message: 'Sensitive provider information' };
    await assert.rejects(
      data.writeReview(input),
      (e) => e.status === status && !e.message.includes('Sensitive'),
    );
  }
});
test('public review batches use only anonymous publishable authority and reject private, inconsistent or excessive projections', async () => {
  const configuration = syntheticConfiguration();
  let projection = { resourceId, reviewCount: 1, averageRating: 4, reviews: [publicRow] },
    calls = 0;
  const data = publicReviewData(configuration, async (raw, init) => {
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), configuration.publishableKey);
    assert.equal(headers.get('authorization'), 'Bearer ' + configuration.publishableKey);
    assert.match(String(raw), /agentgrid_public_reviews$/);
    calls++;
    return Response.json(projection);
  });
  assert.deepEqual(await data(resourceId, 0), { ...projection, offset: 0, hasMore: false });
  projection = {
    resourceId,
    reviewCount: 21,
    averageRating: 4,
    reviews: Array.from({ length: 21 }, (_, i) => ({
      ...publicRow,
      id: '40000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    })),
  };
  const page = await data(resourceId, 0);
  assert.equal(page.reviews.length, 20);
  assert.equal(page.hasMore, true);
  for (const malformed of [
    { ...projection, resourceId: reviewId },
    { ...projection, staffNotes: 'private' },
    { ...projection, reviews: [publicRow, publicRow] },
    {
      ...projection,
      reviews: [{ ...publicRow, author: { ...publicRow.author, email: 'private@example.test' } }],
    },
    { ...projection, reviewCount: 0 },
    { ...projection, averageRating: null },
    { ...projection, reviews: Array.from({ length: 22 }, () => publicRow) },
  ]) {
    projection = malformed;
    await assert.rejects(data(resourceId, 0), fails(503));
  }
  projection = { resourceId, reviewCount: 0, averageRating: null, reviews: [] };
  assert.equal((await data(resourceId, 0)).averageRating, null);
  projection = null;
  await assert.rejects(data(resourceId, 0), fails(404));
  assert.ok(calls > 1);
});

test('public review HTTP needs only public configuration, bounds reads and carries no identity cookies or cache', async () => {
  const environment = {
    AGENTGRID_STAGE: 'production',
    AGENTGRID_ORIGIN: 'https://agentgrid.me',
    NEXT_PUBLIC_SUPABASE_URL: 'https://syntheticfixture.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'x'.repeat(30),
    SUPABASE_SECRET_KEY: 'must-not-be-used',
  };
  const configuration = publicCommunityConfiguration(environment);
  assert.equal('secretKey' in configuration, false);
  for (const change of [
    { AGENTGRID_ORIGIN: 'https://attacker.test' },
    { NEXT_PUBLIC_SUPABASE_URL: 'https://syntheticfixture.supabase.co@attacker.test' },
    { AGENTGRID_STAGE: 'development' },
  ])
    assert.throws(
      () => publicCommunityConfiguration({ ...environment, ...change }),
      (e) => !e.message.includes('must-not-be-used'),
    );
  const calls = [],
    handle = publicCommunityHandler(configuration.origin, async (id, offset) => {
      calls.push({ id, offset });
      return {
        resourceId: id,
        reviewCount: 0,
        averageRating: null,
        reviews: [],
        hasMore: false,
        offset,
      };
    });
  const request = (query, method = 'GET', headers = {}) =>
    new Request(configuration.origin + '/api/community/reviews/?' + query, { method, headers });
  for (const query of [
    'resourceId=bad',
    'resourceId=' + resourceId + '&resourceId=' + resourceId,
    'resourceId=' + resourceId + '&offset=10000',
    'resourceId=' + resourceId + '&offset=-1',
    'resourceId=' + resourceId + '&authorId=' + reviewId,
  ])
    assert.equal((await handle(request(query))).status, 400);
  assert.equal((await handle(request('resourceId=' + resourceId, 'POST'))).status, 405);
  assert.equal(
    (await handle(request('resourceId=' + resourceId, 'GET', { 'sec-fetch-site': 'cross-site' })))
      .status,
    403,
  );
  const response = await handle(
    request('resourceId=' + resourceId + '&offset=20', 'GET', { cookie: 'unexpected=ignored' }),
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  assert.deepEqual(calls, [{ id: resourceId, offset: 20 }]);
});
test('private review HTTP requires identity and CSRF, permits bounded Unicode and rejects caller-selected authority', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = workspaceHandler(identity.runtime, () => ({
    review: async (id) => {
      calls.push(['read', id]);
      return owned;
    },
    reviewContext: async (id) => {
      calls.push(['context', id]);
      return {
        resourceId: id,
        review: owned,
        available: true,
        canReview: true,
        currentVersion: { id: versionId, version: '1.0.0' },
      };
    },
    withdrawReview: async (value) => {
      calls.push(['withdraw', value]);
      return { ...owned, state: 'withdrawn', withdrawnAt: date, revision: 2 };
    },
    writeReview: async (value) => {
      calls.push(['write', value]);
      return owned;
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
  assert.equal(
    (await handle(request('/api/workspace/review/?resourceId=' + resourceId))).status,
    401,
  );
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal((await handle(request('/api/workspace/review/', input))).status, 403);
  for (const invalid of [
    { ...input, authorId: reviewId },
    { ...input, state: 'published' },
    { ...input, rating: 6 },
    { ...input, expectedRevision: -1 },
    { ...input, body: 'thin' },
  ])
    assert.equal((await handle(request('/api/workspace/review/', invalid, csrf))).status, 400);
  assert.equal(
    (
      await handle(
        request('/api/workspace/review/?resourceId=' + resourceId + '&resourceId=' + resourceId),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request('/api/workspace/review/?resourceId=' + resourceId, undefined, undefined, {
          'sec-fetch-site': 'cross-site',
        }),
      )
    ).status,
    403,
  );
  const unicode = { ...input, body: 'अ'.repeat(4000), experience: 'अ'.repeat(1000) };
  assert.equal((await handle(request('/api/workspace/review/', unicode, csrf))).status, 201);
  assert.equal(
    (await handle(request('/api/workspace/review/?resourceId=' + resourceId))).status,
    200,
  );
  assert.equal(
    (await handle(request('/api/workspace/reviewcontext/?resourceId=' + resourceId))).status,
    200,
  );
  assert.equal(
    (
      await handle(
        request('/api/workspace/reviewcontext/?resourceId=' + resourceId + '&role=administrator'),
      )
    ).status,
    400,
  );
  const withdrawal = { resourceId, expectedRevision: 1 };
  assert.equal((await handle(request('/api/workspace/reviewwithdraw/', withdrawal))).status, 403);
  assert.equal(
    (
      await handle(
        request('/api/workspace/reviewwithdraw/', { ...withdrawal, expectedRevision: 0 }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request('/api/workspace/reviewwithdraw/', { ...withdrawal, authorId: reviewId }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (await handle(request('/api/workspace/reviewwithdraw/', withdrawal, csrf))).status,
    200,
  );
  assert.deepEqual(calls, [
    ['write', unicode],
    ['read', resourceId],
    ['context', resourceId],
    ['withdraw', withdrawal],
  ]);
});

test('live eligibility conceals unknown/private targets and withdrawal confirms the exact owner revision', async () => {
  const { state, data, calls } = fixture();
  const context = {
    resourceId,
    review: owned,
    available: true,
    canReview: true,
    currentVersion: { id: versionId, version: '1.0.0' },
  };
  state.context = context;
  assert.deepEqual(await data.reviewContext(resourceId), context);
  assert.deepEqual(calls.at(-1), {
    name: 'agentgrid_review_context',
    body: { resource_id: resourceId },
  });
  for (const malformed of [
    { ...context, resourceId: reviewId },
    { ...context, available: false },
    { ...context, review: { ...owned, resourceId: reviewId } },
    { ...context, available: false, currentVersion: null },
    { ...context, ownerEmail: 'private@example.test' },
  ]) {
    state.context = malformed;
    await assert.rejects(data.reviewContext(resourceId), fails(503));
  }
  state.context = {
    resourceId,
    review: owned,
    available: false,
    canReview: false,
    currentVersion: null,
  };
  assert.equal((await data.reviewContext(resourceId)).review.id, reviewId);
  const withdrawn = { ...owned, state: 'withdrawn', withdrawnAt: date, revision: 2 };
  state.owned = withdrawn;
  assert.deepEqual(await data.withdrawReview({ resourceId, expectedRevision: 1 }), withdrawn);
  assert.deepEqual(calls.find((c) => c.name === 'agentgrid_withdraw_review').body, {
    resource_id: resourceId,
    expected_revision: 1,
  });
  for (const wrong of [
    owned,
    { ...withdrawn, revision: 3 },
    { ...withdrawn, withdrawnAt: null },
    { ...withdrawn, id: versionId },
  ]) {
    state.owned = wrong;
    await assert.rejects(data.withdrawReview({ resourceId, expectedRevision: 1 }), fails(503));
  }
  state.owned = withdrawn;
  await assert.rejects(data.writeReview({ ...input, expectedRevision: 1 }), fails(503));
  const before = calls.length;
  await assert.rejects(
    data.withdrawReview({ resourceId, expectedRevision: 1, authorId: reviewId }),
    fails(400),
  );
  assert.equal(calls.length, before);
});
