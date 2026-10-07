import test from 'node:test';
import assert from 'node:assert/strict';
import { readPublicReviews } from '../src/services/public-community.ts';

const resourceId = '20000000-0000-4000-8000-000000000001';
test('public browser reader omits credentials, binds resource/page and conceals malformed provider data', async (t) => {
  const previous = globalThis.fetch,
    calls = [];
  t.after(() => {
    globalThis.fetch = previous;
  });
  const valid = {
    resourceId,
    reviewCount: 0,
    averageRating: null,
    reviews: [],
    offset: 0,
    hasMore: false,
  };
  let response = () => Response.json(valid);
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return response();
  };
  const controller = new AbortController();
  assert.deepEqual(await readPublicReviews(resourceId, 0, controller.signal), valid);
  assert.equal(calls[0].url, '/api/community/reviews/?resourceId=' + resourceId + '&offset=0');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers, undefined);
  for (const projection of [
    { ...valid, resourceId: '40000000-0000-4000-8000-000000000001' },
    { ...valid, offset: 20 },
    { ...valid, privateEmail: 'must-not-render@example.test' },
    { ...valid, hasMore: true },
    { ...valid, averageRating: 4 },
  ]) {
    response = () => Response.json(projection);
    await assert.rejects(
      readPublicReviews(resourceId, 0, controller.signal),
      (e) => e.code === 'service-unavailable' && !e.message.includes('must-not-render'),
    );
  }
  response = () => new Response('Sensitive raw provider failure', { status: 503 });
  await assert.rejects(
    readPublicReviews(resourceId, 0, controller.signal),
    (e) => e.code === 'service-unavailable' && !e.message.includes('Sensitive'),
  );
  response = () => new Response('', { status: 404 });
  await assert.rejects(
    readPublicReviews(resourceId, 0, controller.signal),
    (e) => e.code === 'not-found',
  );
  const before = calls.length;
  for (const [id, offset] of [
    ['bad', 0],
    [resourceId, -1],
    [resourceId, 10000],
    [resourceId, 1.5],
  ])
    await assert.rejects(
      readPublicReviews(id, offset, controller.signal),
      (e) => e.code === 'invalid-request',
    );
  assert.equal(calls.length, before);
});
