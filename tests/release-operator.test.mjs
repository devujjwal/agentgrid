import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseArguments, runReleaseAction } from '../scripts/release-reviewed.mjs';
import { releaseOperatorClient } from '../backend/publication/operator-client.ts';
import { reviewedReleaseFixture } from './fixtures/reviewed-release.mjs';
const id = '50000000-0000-4000-8000-000000000001',
  now = new Date('2026-10-08T00:00:00Z');
const configuration = {
  AGENTGRID_STAGE: 'preview',
  AGENTGRID_ORIGIN: 'https://agentgrid-staging.pages.dev',
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(30),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 'b'.repeat(30),
};
test('operator requires an explicit action and exact publication arguments outside CI', () => {
  assert.equal(releaseArguments(['prepare', id], {}).action, 'prepare');
  for (const args of [
    [],
    ['publish', id],
    ['inspect', id, 'extra'],
    ['prepare', '../request'],
    ['publish', id, 'a'.repeat(64), 'main'],
  ])
    assert.throws(() => releaseArguments(args, {}));
  assert.throws(() => releaseArguments(['inspect', id], { CI: 'true' }));
  assert.throws(() => releaseArguments(['inspect', id], { GITHUB_ACTIONS: 'true' }));
});
test('dry preparation is read-only and publish binds the same review before writing', async () => {
  const { bundle, approval } = await reviewedReleaseFixture();
  const calls = [];
  const client = {
    rpc: async (name) => {
      calls.push(name);
      return {
        error: null,
        data:
          name === 'agentgrid_prepare_release_request'
            ? bundle
            : { ...approval, state: 'released', decidedAt: now.toISOString() },
      };
    },
  };
  const preparation = await runReleaseAction(client, { action: 'prepare', requestId: id }, now);
  assert.deepEqual(calls, ['agentgrid_prepare_release_request']);
  assert.match(preparation.reviewFingerprint, /^[a-f0-9]{64}$/);
  const serialized = JSON.stringify(preparation);
  for (const privateField of [
    'observed_output',
    'reviewer_notes',
    'explanation',
    'host_run_sha256',
    'specification',
  ])
    assert.ok(!serialized.includes(privateField));
  calls.length = 0;
  await assert.rejects(
    runReleaseAction(
      client,
      { action: 'publish', requestId: id, fingerprint: 'f'.repeat(64) },
      now,
    ),
    /Prepared review changed/,
  );
  assert.deepEqual(calls, ['agentgrid_prepare_release_request']);
  calls.length = 0;
  assert.equal(
    (
      await runReleaseAction(
        client,
        { action: 'publish', requestId: id, fingerprint: preparation.reviewFingerprint },
        now,
      )
    ).state,
    'released',
  );
  assert.deepEqual(calls, [
    'agentgrid_prepare_release_request',
    'agentgrid_execute_release_request',
    'agentgrid_release_request_status',
  ]);
});
test('uncertain publication never retries and separate inspection reveals the historical outcome', async () => {
  const { bundle, approval } = await reviewedReleaseFixture();
  const calls = [];
  const client = {
    rpc: async (name) => {
      calls.push(name);
      return name === 'agentgrid_execute_release_request'
        ? { error: { message: 'provider-secret' }, data: null }
        : {
            error: null,
            data:
              name === 'agentgrid_prepare_release_request'
                ? bundle
                : { ...approval, state: 'released', decidedAt: now.toISOString() },
          };
    },
  };
  const preparation = await runReleaseAction(client, { action: 'prepare', requestId: id }, now);
  await assert.rejects(
    runReleaseAction(
      client,
      { action: 'publish', requestId: id, fingerprint: preparation.reviewFingerprint },
      now,
    ),
    /read the recorded outcome/,
  );
  assert.equal(calls.filter((name) => name === 'agentgrid_execute_release_request').length, 1);
  const status = await runReleaseAction(client, { action: 'inspect', requestId: id }, now);
  assert.equal(status.state, 'released');
  assert.match(status.meaning, /not proof of current visibility/);
});
test('actual SDK publisher transport refuses arbitrary endpoints, writes in read-only mode, redirects and oversized bodies', async () => {
  const calls = [];
  const client = releaseOperatorClient(configuration, false, async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response('null', { headers: { 'Content-Type': 'application/json' } });
  });
  assert.equal(
    (await client.rpc('agentgrid_release_request_status', { request_id: id })).error,
    null,
  );
  assert.equal(calls[0].init.redirect, 'error');
  assert.ok(calls[0].init.signal instanceof AbortSignal);
  assert.equal(new Headers(calls[0].init.headers).get('apikey'), configuration.SUPABASE_SECRET_KEY);
  assert.ok((await client.rpc('agentgrid_execute_release_request', {})).error);
  assert.ok((await client.rpc('picmagic_admin', {})).error);
  assert.equal(calls.length, 1);
  for (const response of [
    new Response('provider-secret', { status: 503 }),
    new Response('null', { headers: { 'Content-Type': 'text/plain' } }),
    new Response('null', {
      headers: { 'Content-Type': 'application/json', 'Content-Length': '3000001' },
    }),
    new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(3_000_001));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'application/json' } },
    ),
  ]) {
    const bounded = releaseOperatorClient(configuration, true, async () => response);
    const result = await bounded.rpc('agentgrid_release_request_status', { request_id: id });
    assert.ok(result.error);
    assert.ok(!JSON.stringify(result.error).includes('provider-secret'));
  }
  assert.throws(() =>
    releaseOperatorClient(
      { ...configuration, NEXT_PUBLIC_SUPABASE_URL: 'https://attacker.example' },
      true,
    ),
  );
});
