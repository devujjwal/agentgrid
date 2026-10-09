import { measurementPayload } from '../src/analytics/payload.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { AnalyticsEventSchema } from '../src/domain/analytics.ts';
import { createMeasurements, resultBand } from '../src/analytics/client.ts';
import { analyticsHandler } from '../backend/analytics/collector.ts';
import { analyticsStore } from '../backend/analytics/store.ts';
const origin = 'https://agentgrid.me';
const sample = { event: 'search', kind: 'all', results: 'few' };
test('analytics refuses arbitrary free text and private identity dimensions', () => {
  assert.deepEqual(AnalyticsEventSchema.parse(sample), sample);
  assert.deepEqual(measurementPayload({ ...sample, query: 'private', userId: 'secret' }), sample);
  assert.equal(measurementPayload({ event: 'page_view', page: 'private-person' }), null);
  assert.equal(
    measurementPayload({
      event: 'agent_view',
      resourceId: 'private-email@example.test',
      versionId: 'bad',
    }),
    null,
  );
  for (const input of [
    { ...sample, query: 'private medical question' },
    { ...sample, userId: 'private' },
    { ...sample, referrer: 'https://private.test' },
    { ...sample, results: 'secret' },
    { event: 'page_view', page: 'workspace' },
    { event: 'agent_view', resourceId: 'private-slug' },
    { event: 'install_success' },
  ])
    assert.equal(AnalyticsEventSchema.safeParse(input).success, false);
  assert.deepEqual([0, 1, 2, 5, 6, 100].map(resultBand), [
    'none',
    'one',
    'few',
    'few',
    'many',
    'many',
  ]);
});
test('client honors privacy signals, preview exclusion, explicit enablement and bounded no-retry transport', async () => {
  let context = {
    enabled: true,
    origin,
    doNotTrack: null,
    globalPrivacyControl: false,
    preview: false,
  };
  const sent = [];
  const measure = createMeasurements(
    () => context,
    async (url, init) => {
      sent.push({ url, init });
      throw new Error('offline');
    },
  );
  for (const change of [
    { enabled: false },
    { origin: 'http://localhost:3027' },
    { doNotTrack: '1' },
    { globalPrivacyControl: true },
    { preview: true },
  ]) {
    context = {
      enabled: true,
      origin,
      doNotTrack: null,
      globalPrivacyControl: false,
      preview: false,
      ...change,
    };
    measure(sample);
  }
  assert.equal(sent.length, 0);
  context = {
    enabled: true,
    origin,
    doNotTrack: null,
    globalPrivacyControl: false,
    preview: false,
  };
  for (let i = 0; i < 25; i++) measure(sample);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sent.length, 20);
  for (const { url, init } of sent) {
    assert.equal(url, '/api/analytics/');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.deepEqual(JSON.parse(init.body), sample);
    assert.equal(new Headers(init.headers).has('authorization'), false);
  }
});
test('collector checks origin, closed input and privacy headers without session/provider disclosure', async () => {
  const calls = [];
  const handler = analyticsHandler(origin, true, async (event) => calls.push(event));
  const request = (body = sample, headers = {}, url = origin + '/api/analytics/') =>
    new Request(url, {
      method: 'POST',
      headers: { origin, 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  const response = await handler(request());
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('set-cookie'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(calls, [sample]);
  for (const h of [{ 'sec-gpc': '1' }, { dnt: '1' }])
    assert.equal((await handler(request(sample, h))).status, 204);
  assert.equal(calls.length, 1);
  assert.equal((await handler(request(sample, { origin: 'https://evil.test' }))).status, 403);
  assert.equal((await handler(request({ ...sample, query: 'private' }))).status, 400);
  assert.equal((await handler(request({ payload: 'x'.repeat(600) }))).status, 413);
  assert.equal(
    (await handler(request(sample, {}, origin + '/api/analytics/?query=private'))).status,
    404,
  );
  assert.equal((await handler(new Request(origin + '/api/analytics/'))).status, 405);
  const disabled = analyticsHandler(origin, false, async () =>
    assert.fail('disabled collection called store'),
  );
  assert.equal((await disabled(request())).status, 204);
  const broken = analyticsHandler(origin, true, async () => {
    throw new Error('private credential details');
  });
  const failure = await broken(request());
  assert.equal(failure.status, 503);
  assert.ok(!(await failure.text()).includes('credential'));
});
test('store sends only validated observations to its fixed RPC with a bounded server credential', async () => {
  const environment = {
    AGENTGRID_STAGE: 'production',
    AGENTGRID_ORIGIN: origin,
    NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(24),
    SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(24),
  };
  const calls = [];
  const record = analyticsStore(environment, async (url, init) => {
    calls.push({ url, init });
    return new Response('true');
  });
  await record(sample);
  assert.equal(
    calls[0].url,
    'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_analytics_record',
  );
  assert.equal(calls[0].init.redirect, 'manual');
  assert.deepEqual(JSON.parse(calls[0].init.body), { measurement: sample });
  await assert.rejects(record({ ...sample, query: 'private' }));
  assert.equal(calls.length, 1);
  await assert.rejects(
    analyticsStore(
      environment,
      async () => new Response('private upstream error', { status: 500 }),
    )(sample),
    /could not be completed/,
  );
});
