import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { reviewResources } from '../backend/workspace/reviews.ts';
import { publicReviewData } from '../backend/community/reviews.ts';
import { syntheticConfiguration } from './fixtures/identity.mjs';

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
        if (name === 'agentgrid_write_review') return Response.json(state.write);
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
  const page = await data(resourceId, 20);
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
