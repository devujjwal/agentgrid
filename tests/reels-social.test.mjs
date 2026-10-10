import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReel, renderReel, inspectReel } from '../backend/execution/reels.ts';
import { deliverPublication, reconcilePublication } from '../backend/execution/social-delivery.ts';
import { publicationPreviewDigest } from '../backend/execution/publication-approval.ts';
import { ReelPlanSchema } from '../backend/execution/reel-contracts.ts';
import { persistPrivateVideo, readPrivateVideo } from '../backend/execution/media.ts';
import { sealSocialTokens, openSocialTokens } from '../backend/execution/social-secrets.ts';
import { mediaCapabilities } from '../backend/execution/media-controls.ts';
import { reelStore } from '../backend/execution/reel-store.ts';
const ownerId = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const sourceRunId = '33333333-3333-4333-8333-333333333333';
const connectionId = '44444444-4444-4444-8444-444444444444';
const actor = { profileId: ownerId, active: true };
const plan = {
  sourceRunId,
  title: 'Synthetic garden reel',
  narration: 'Synthetic fixture only.',
  scenes: [{ seconds: 5, visual: 'A synthetic garden.', onScreenText: 'Fixture' }],
  format: 'portrait-720p',
};
function assetFor(run) {
  const id = crypto.randomUUID();
  return {
    id,
    ownerId,
    runId: run.id,
    key: `owners/${ownerId}/reels/${run.id}/${id}.mp4`,
    sha256: 'a'.repeat(64),
    bytes: 12,
    contentType: 'video/mp4',
    width: 720,
    height: 1280,
    seconds: 5,
  };
}
function reelFixture() {
  const records = new Map();
  let submits = 0,
    polls = 0;
  const store = {
    async prepare(r) {
      const found = [...records.values()].find(
        (x) => x.ownerId === r.ownerId && x.idempotencyKey === r.idempotencyKey,
      );
      if (found) return structuredClone(found);
      records.set(r.id, structuredClone(r));
      return structuredClone(r);
    },
    async read(owner, id) {
      const r = records.get(id);
      return r?.ownerId === owner ? structuredClone(r) : null;
    },
    async claim(owner, id, digest) {
      const r = records.get(id);
      if (!r || r.ownerId !== owner || r.digest !== digest || r.state !== 'queued') return false;
      r.state = 'rendering';
      return true;
    },
    async task(owner, id, taskId) {
      const r = records.get(id);
      if (r?.ownerId === owner) r.taskId = taskId;
    },
    async finish(owner, id, asset) {
      const r = records.get(id);
      if (r?.ownerId !== owner || r.state === 'ready') return;
      if (r.state !== 'cancelled') {
        r.state = asset ? 'ready' : 'uncertain';
        r.asset = asset;
      }
    },
  };
  const provider = {
    identity: 'synthetic-only/reel-v1',
    estimate: () => 1000,
    async submit() {
      submits++;
      return { taskId: 'synthetic-task' };
    },
    async inspect() {
      polls++;
      return { state: 'pending' };
    },
  };
  const setup = {
    enabled: true,
    actor,
    store,
    provider,
    request: { idempotencyKey: crypto.randomUUID(), plan },
  };
  return {
    records,
    store,
    provider,
    setup,
    counters: () => ({ submits, polls }),
    render: (run) =>
      renderReel({
        enabled: true,
        actor,
        store,
        provider,
        runId: run.id,
        approvedDigest: run.digest,
      }),
    inspect: (run) => inspectReel({ enabled: true, actor, store, provider, runId: run.id }),
  };
}
test('disabled reel preparation and dispatch touch neither storage nor provider', async () => {
  const f = reelFixture();
  await assert.rejects(prepareReel({ ...f.setup, enabled: false }), /disabled/);
  await assert.rejects(
    renderReel({
      enabled: false,
      actor,
      store: f.store,
      provider: f.provider,
      runId: sourceRunId,
      approvedDigest: 'a'.repeat(64),
    }),
    /disabled/,
  );
  await assert.rejects(
    inspectReel({
      enabled: false,
      actor,
      store: f.store,
      provider: f.provider,
      runId: sourceRunId,
    }),
    /disabled/,
  );
  assert.equal(f.records.size, 0);
  assert.deepEqual(f.counters(), { submits: 0, polls: 0 });
});
test('reel plans enforce duration, format, bounded text and trusted provider quote', async () => {
  assert.equal(
    ReelPlanSchema.safeParse({
      ...plan,
      scenes: Array.from({ length: 4 }, () => ({ ...plan.scenes[0], seconds: 10 })),
    }).success,
    false,
  );
  assert.equal(ReelPlanSchema.safeParse({ ...plan, format: 'landscape' }).success, false);
  assert.equal(
    ReelPlanSchema.safeParse({ ...plan, toolUrl: 'https://example.com' }).success,
    false,
  );
  const f = reelFixture();
  await assert.rejects(
    prepareReel({ ...f.setup, provider: { ...f.provider, estimate: () => NaN } }),
  );
  await assert.rejects(
    prepareReel({ ...f.setup, request: { ...f.setup.request, ownerId: otherId } }),
  );
});
test('reel preparation is idempotent and altered plans invalidate that key', async () => {
  const f = reelFixture();
  const r = await prepareReel(f.setup);
  assert.equal((await prepareReel(f.setup)).id, r.id);
  await assert.rejects(
    prepareReel({
      ...f.setup,
      request: { ...f.setup.request, plan: { ...plan, narration: 'Changed' } },
    }),
    /idempotency_conflict/,
  );
});
test('concurrent reel dispatch submits once and polling only reads the persisted task', async () => {
  const f = reelFixture(),
    r = await prepareReel(f.setup);
  await Promise.all([f.render(r), f.render(r)]);
  await Promise.all([f.inspect(r), f.inspect(r)]);
  assert.deepEqual(f.counters(), { submits: 1, polls: 2 });
  assert.equal(f.records.get(r.id).taskId, 'synthetic-task');
  f.provider.inspect = async () => ({ state: 'succeeded', asset: assetFor(r), billedMicros: 200 });
  await f.inspect(r);
  assert.equal(f.records.get(r.id).state, 'ready');
  await f.render(r);
  assert.equal(f.counters().submits, 1);
});
test('lost submit or persistence outcome is uncertain and never submitted again', async () => {
  const f = reelFixture(),
    r = await prepareReel(f.setup);
  f.store.task = async () => {
    throw new Error('secret');
  };
  await assert.rejects(f.render(r), (error) => error.message === 'provider_unavailable');
  assert.equal(f.records.get(r.id).state, 'uncertain');
  await f.render(r);
  assert.equal(f.counters().submits, 1);
});
test('poll failures preserve known task while foreign media and excess cost are rejected', async () => {
  const f = reelFixture(),
    r = await prepareReel(f.setup);
  await f.render(r);
  f.provider.inspect = async () => {
    throw new Error('secret');
  };
  await assert.rejects(f.inspect(r), /provider_unavailable/);
  assert.equal(f.records.get(r.id).state, 'rendering');
  assert.equal(f.records.get(r.id).taskId, 'synthetic-task');
  f.provider.inspect = async () => ({
    state: 'succeeded',
    asset: { ...assetFor(r), ownerId: otherId },
    billedMicros: 200,
  });
  await assert.rejects(f.inspect(r));
  f.provider.inspect = async () => ({ state: 'succeeded', asset: assetFor(r), billedMicros: 1001 });
  await assert.rejects(f.inspect(r));
  assert.equal(f.records.get(r.id).asset, null);
});
test('reel cancellation while polling discards arriving output', async () => {
  const f = reelFixture(),
    r = await prepareReel(f.setup);
  await f.render(r);
  f.provider.inspect = async () => {
    f.records.get(r.id).state = 'cancelled';
    return { state: 'succeeded', asset: assetFor(r), billedMicros: 200 };
  };
  await f.inspect(r);
  assert.equal(f.records.get(r.id).asset, null);
  assert.equal(f.records.get(r.id).state, 'cancelled');
});
async function socialFixture() {
  const run = { id: sourceRunId };
  const asset = assetFor(run);
  const preview = {
    runId: run.id,
    revision: 1,
    mediaId: asset.id,
    mediaSha256: asset.sha256,
    destinations: [{ platform: 'instagram', connectionId, caption: 'Synthetic caption' }],
    scheduledAt: '2026-10-10T12:00:00Z',
  };
  const digest = await publicationPreviewDigest(preview);
  const record = {
    id: crypto.randomUUID(),
    ownerId,
    preview,
    digest,
    connectionId,
    state: 'pending',
    providerPostId: null,
  };
  const context = {
    asset,
    approval: { ownerId, digest, expiresAt: '2026-10-11T12:00:00Z' },
    connections: [{ id: connectionId, ownerId, platform: 'instagram', publishingEnabled: true }],
  };
  let posts = 0;
  const store = {
    async read(owner) {
      return owner === ownerId ? structuredClone(record) : null;
    },
    async context() {
      return structuredClone(context);
    },
    async claim(owner, id, d) {
      if (owner !== ownerId || id !== record.id || d !== digest || record.state !== 'pending')
        return false;
      record.state = 'dispatching';
      return true;
    },
    async submitted(owner, id, postId) {
      if (owner === ownerId && id === record.id) record.providerPostId = postId;
    },
    async finish(owner, id, postId) {
      if (
        owner === ownerId &&
        id === record.id &&
        (record.state === 'dispatching' || (record.state === 'uncertain' && postId))
      )
        Object.assign(record, {
          state: postId ? 'published' : 'uncertain',
          providerPostId: postId ?? record.providerPostId,
        });
    },
  };
  const publisher = {
    platform: 'instagram',
    async publish() {
      posts++;
      return { postId: 'synthetic-post' };
    },
    async verify() {
      return true;
    },
  };
  const options = {
    enabled: true,
    actor,
    deliveryId: record.id,
    store,
    publisher,
    now: new Date('2026-10-10T12:00:01Z'),
  };
  return { record, context, publisher, options, posts: () => posts };
}
test('disabled, not-due, revoked, altered asset and foreign social deliveries never post', async () => {
  for (const edit of [
    (f) => {
      f.options.enabled = false;
    },
    (f) => {
      f.options.now = new Date('2026-10-10T11:00:00Z');
    },
    (f) => {
      f.context.connections[0].publishingEnabled = false;
    },
    (f) => {
      f.context.asset.sha256 = 'b'.repeat(64);
    },
    (f) => {
      f.options.actor = { profileId: otherId, active: true };
    },
  ]) {
    const f = await socialFixture();
    edit(f);
    await assert.rejects(deliverPublication(f.options));
    assert.equal(f.posts(), 0);
  }
});
test('delivery confirms provider readback and concurrent retry never republishes', async () => {
  const f = await socialFixture();
  await Promise.all([deliverPublication(f.options), deliverPublication(f.options)]);
  assert.equal(f.posts(), 1);
  assert.equal(f.record.state, 'published');
  await deliverPublication(f.options);
  assert.equal(f.posts(), 1);
});
test('unconfirmed social response is uncertain with no automatic repost', async () => {
  const f = await socialFixture();
  f.publisher.verify = async () => false;
  await assert.rejects(deliverPublication(f.options), /provider_unavailable/);
  assert.equal(f.record.state, 'uncertain');
  assert.equal(f.record.providerPostId, 'synthetic-post');
  await deliverPublication(f.options);
  assert.equal(f.posts(), 1);
});
test('private video checks decoded format, immutable owner key and readback checksum', async () => {
  const objects = new Map();
  const bucket = {
    async put(k, b) {
      objects.set(k, b.slice().buffer);
    },
    async get(k) {
      return objects.has(k) ? { arrayBuffer: async () => objects.get(k) } : null;
    },
    async delete(k) {
      objects.delete(k);
    },
  };
  const bytes = new Uint8Array([0, 0, 0, 12, 102, 116, 121, 112, 105, 115, 111, 109]);
  const probe = {
    async inspect() {
      return { width: 720, height: 1280, seconds: 5, videoCodec: 'h264', audioCodec: 'aac' };
    },
  };
  const asset = await persistPrivateVideo({ ownerId, runId: sourceRunId, bytes, bucket, probe });
  const response = await readPrivateVideo(ownerId, asset, bucket);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  await assert.rejects(readPrivateVideo(otherId, asset, bucket));
  await assert.rejects(
    persistPrivateVideo({
      ownerId,
      runId: sourceRunId,
      bytes,
      bucket,
      probe: {
        inspect: async () => ({
          width: 1280,
          height: 720,
          seconds: 5,
          videoCodec: 'h264',
          audioCodec: null,
        }),
      },
    }),
  );
  objects.set(asset.key, new Uint8Array(12).buffer);
  await assert.rejects(readPrivateVideo(ownerId, asset, bucket));
});
test('social secrets reject token swaps, tampering, expiry and malformed ciphertext', async () => {
  const key = crypto.getRandomValues(new Uint8Array(32)),
    context = { ownerId, connectionId, platform: 'instagram' };
  const tokens = {
    accessToken: 'synthetic-secret',
    refreshToken: null,
    expiresAt: '2026-10-11T12:00:00Z',
  };
  const sealed = await sealSocialTokens(key, context, tokens);
  assert.ok(!sealed.includes(tokens.accessToken));
  assert.deepEqual(await openSocialTokens(key, context, sealed, new Date('2026-10-10')), tokens);
  for (const args of [
    [key, { ...context, ownerId: otherId }, sealed, new Date('2026-10-10')],
    [key, { ...context, platform: 'linkedin' }, sealed, new Date('2026-10-10')],
    [key, context, sealed, new Date('2026-10-12')],
    [key, context, sealed + '.extra', new Date('2026-10-10')],
    [new Uint8Array(32), context, sealed, new Date('2026-10-10')],
  ])
    await assert.rejects(openSocialTokens(...args), /Connection secret unavailable/);
});
test('media adapter uses fixed subject-scoped RPC and refuses redirected credentials', async () => {
  const environment = {
    SUPABASE_SECRET_KEY: 'sb_secret_' + 'x'.repeat(30),
    AGENTGRID_STAGE: 'production',
    AGENTGRID_ORIGIN: 'https://agentgrid.me',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'x'.repeat(30),
  };
  let seen;
  const adapter = reelStore(environment, ownerId, async (url, init) => {
    seen = { url, init };
    return new Response('null');
  });
  assert.equal(await adapter.reels.read(otherId, sourceRunId), null);
  assert.equal(seen.url, 'https://example.supabase.co/rest/v1/rpc/agentgrid_server_media');
  assert.equal(seen.init.redirect, 'manual');
  assert.equal(JSON.parse(seen.init.body).actor_user_id, ownerId);
  const redirect = reelStore(
    environment,
    ownerId,
    async () => new Response(null, { status: 302, headers: { Location: 'https://evil.invalid' } }),
  );
  await assert.rejects(redirect.reels.read(ownerId, sourceRunId));
});

test('global execution off wins over individual reel and social flags', () => {
  assert.deepEqual(
    mediaCapabilities({
      AGENTGRID_EXECUTION_ENABLED: '0',
      AGENTGRID_REEL_GENERATION_ENABLED: '1',
      AGENTGRID_SOCIAL_PUBLISHING_ENABLED: '1',
    }),
    { connect: false, render: false, publish: false },
  );
  assert.deepEqual(mediaCapabilities({}), { connect: false, render: false, publish: false });
  assert.deepEqual(
    mediaCapabilities({ AGENTGRID_EXECUTION_ENABLED: '1', AGENTGRID_REEL_GENERATION_ENABLED: '1' }),
    { connect: false, render: true, publish: false },
  );
});

test('ambiguous delivery with a saved post ID can be reconciled without republishing', async () => {
  const f = await socialFixture();
  f.publisher.verify = async () => false;
  await assert.rejects(deliverPublication(f.options));
  assert.equal(f.record.providerPostId, 'synthetic-post');
  f.publisher.verify = async () => true;
  await reconcilePublication(f.options);
  assert.equal(f.record.state, 'published');
  assert.equal(f.posts(), 1);
});
