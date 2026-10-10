import test from 'node:test';
import assert from 'node:assert/strict';
import { shotstackTimeline, shotstackProvider } from '../backend/integrations/shotstack.ts';
import { socialPublisher } from '../backend/integrations/social.ts';
import { socialOAuth } from '../backend/integrations/oauth.ts';
import { approvedUrl, providerJson, sha256 } from '../backend/integrations/http.ts';
import { openSocialTokens } from '../backend/execution/social-secrets.ts';
const ownerId = '11111111-1111-4111-8111-111111111111';
const runId = '22222222-2222-4222-8222-222222222222';
const connectionId = '33333333-3333-4333-8333-333333333333';
const deliveryId = '44444444-4444-4444-8444-444444444444';
const taskId = '55555555-5555-4555-8555-555555555555';
const now = () => new Date('2026-10-10T12:00:00Z');
const signal = () => new AbortController().signal;
const reply = (body) => Response.json(body);
const plan = {
  sourceRunId: runId,
  title: 'Synthetic reel',
  narration: 'This is a fixture.',
  scenes: [
    { seconds: 5, visual: 'A garden', onScreenText: 'Synthetic' },
    { seconds: 5, visual: 'A pond', onScreenText: 'Fixture' },
  ],
  format: 'portrait-720p',
};
const bytes = new Uint8Array(12);
bytes.set(new TextEncoder().encode('ftyp'), 4);
const asset = {
  id: taskId,
  ownerId,
  runId,
  key: `owners/${ownerId}/reels/${runId}/${taskId}.mp4`,
  sha256: await sha256(bytes),
  bytes: 12,
  contentType: 'video/mp4',
  width: 720,
  height: 1280,
  seconds: 10,
};
function renderer(overrides = {}) {
  return shotstackProvider({
    enabled: () => true,
    transport: async () => reply({ success: true, response: { id: taskId, status: 'queued' } }),
    apiKey: async () => 'fixture-key',
    rates: {
      revision: 'fixture',
      imageMicros: 100,
      speechCharacterMicros: 1,
      renderSecondMicros: 10,
    },
    outputHosts: ['render.example'],
    bucket: { put: async () => {}, get: async () => null, delete: async () => {} },
    probe: {
      inspect: async () => ({
        width: 720,
        height: 1280,
        seconds: 10,
        videoCodec: 'h264',
        audioCodec: 'aac',
      }),
    },
    context: async () => ({ ownerId, runId, maximumCostMicros: 1000 }),
    billedCost: async () => 100,
    ...overrides,
  });
}
function publishing(platform, transport, overrides = {}) {
  const stages = [];
  let attempted = false;
  const accountId = platform === 'linkedin' ? 'urn:li:person:fixture' : '123';
  const options = {
    enabled: () => true,
    transport,
    now,
    connection: async () => ({
      id: connectionId,
      ownerId,
      platform,
      accountId,
      accessToken: 'fixture-token',
      expiresAt: '2026-10-11T12:00:00Z',
      publishingEnabled: true,
      scopes: [
        'w_member_social',
        'r_member_social',
        'pages_manage_posts',
        'pages_read_engagement',
        'instagram_basic',
        'instagram_content_publish',
      ],
    }),
    receipts: {
      begin: async () => {
        if (attempted) return false;
        attempted = true;
        return true;
      },
      pending: async () =>
        stages.at(-1)?.stage === 'upload' ? { mediaId: stages.at(-1).id } : null,
      save: async (_, stage, id) => {
        if (stage === 'publishing' && stages.at(-1)?.stage !== 'upload')
          throw new Error('Receipt transition refused.');
        stages.push({ stage, id });
      },
      published: async () => ({
        mediaId: stages.find((s) => s.stage === 'upload')?.id ?? 'missing',
      }),
    },
    bytes: async () => bytes,
    mediaUrl: async () => 'https://media.example/grant',
    mediaHosts: ['media.example'],
    metaVersion: 'v23.0',
    ...overrides,
  };
  return {
    publisher: socialPublisher(platform, options),
    stages,
    input: {
      connectionId,
      caption: 'Synthetic acceptance test',
      asset,
      deliveryId,
      signal: signal(),
    },
  };
}
test('disabled adapters do not read credentials, bytes, ledger or call transport', async () => {
  const forbidden = async () => {
    throw new Error('Unexpected side effect');
  };
  const render = renderer({
    enabled: () => false,
    apiKey: forbidden,
    transport: forbidden,
    context: forbidden,
  });
  await assert.rejects(render.submit(plan, runId, signal()), /disabled/);
  await assert.rejects(render.inspect(taskId, signal()), /disabled/);
  for (const platform of ['instagram', 'facebook', 'linkedin']) {
    const f = publishing(platform, forbidden, {
      enabled: () => false,
      connection: forbidden,
      bytes: forbidden,
    });
    await assert.rejects(f.publisher.publish(f.input), /disabled/);
    await assert.rejects(f.publisher.verify({ ...f.input, postId: '123' }), /disabled/);
  }
});
test('composition pins models, portrait output and exact scene timing', () => {
  const result = shotstackTimeline(plan);
  assert.deepEqual(
    result.timeline.tracks[1].clips.map((c) => [c.start, c.length]),
    [
      [0, 5],
      [5, 5],
    ],
  );
  assert.equal(result.timeline.tracks[1].clips[0].asset.model, 'nano-banana-2');
  assert.equal(result.timeline.tracks[2].clips[0].asset.model, 'polly-neural');
  assert.deepEqual(result.output.size, { width: 720, height: 1280 });
  assert.throws(() => shotstackTimeline({ ...plan, narration: 'word '.repeat(100) }), /too long/);
});
test('render status needs task ownership and verified billing before downloading', async () => {
  let calls = 0;
  const transport = async () => {
    calls++;
    return reply({
      success: true,
      response: { id: taskId, status: 'done', url: 'https://render.example/out.mp4' },
    });
  };
  assert.deepEqual(
    await renderer({ transport, billedCost: async () => null }).inspect(taskId, signal()),
    { state: 'pending' },
  );
  assert.equal(calls, 1);
  await assert.rejects(
    renderer({ transport, context: async () => null }).inspect(taskId, signal()),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    renderer({ transport, billedCost: async () => 1001 }).inspect(taskId, signal()),
  );
  assert.equal(calls, 2);
});
test('renderer downloads without credentials and validates actual bytes before private storage', async () => {
  let stored;
  let requests = 0;
  const r = renderer({
    transport: async (url, init) => {
      requests++;
      assert.equal(init.redirect, 'manual');
      if (String(url).startsWith('https://api.shotstack.io'))
        return reply({
          success: true,
          response: { id: taskId, status: 'done', url: 'https://render.example/out.mp4' },
        });
      assert.equal(init.headers, undefined);
      return new Response(bytes);
    },
    bucket: {
      put: async (key, data) => {
        stored = { key, data };
      },
      get: async () => null,
      delete: async () => {},
    },
  });
  const result = await r.inspect(taskId, signal());
  assert.equal(result.state, 'succeeded');
  assert.equal(requests, 2);
  assert.equal(stored.key, result.asset.key);
  assert.equal(result.asset.sha256, asset.sha256);
});
test('provider transport rejects redirects, oversize bodies and hostile output URLs', async () => {
  await assert.rejects(
    providerJson(
      async () =>
        new Response(null, { status: 302, headers: { Location: 'https://hostile.example' } }),
      'https://api.example',
      {},
    ),
  );
  await assert.rejects(
    providerJson(async () => new Response('x'.repeat(500001)), 'https://api.example', {}),
  );
  assert.throws(() => approvedUrl('https://media.example@hostile.example/x', ['media.example']));
  assert.throws(() => approvedUrl('https://media.example:444/x', ['media.example']));
});
test('Instagram persists container before publishing and verifies caption on owned account edge', async () => {
  const calls = [];
  const f = publishing('instagram', async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('media_publish')) return reply({ id: '999' });
    if (String(url).includes('status_code')) return reply({ id: '888', status_code: 'FINISHED' });
    if (init.method === 'POST') return reply({ id: '888' });
    return reply({
      data: [{ id: '999', caption: 'Synthetic acceptance test', media_product_type: 'REELS' }],
    });
  });
  assert.deepEqual(await f.publisher.publish(f.input), { postId: '999' });
  assert.deepEqual(
    f.stages.map((s) => s.stage),
    ['upload', 'publishing', 'published'],
  );
  assert.equal(await f.publisher.verify({ ...f.input, postId: '999' }), true);
  assert.equal(await f.publisher.verify({ ...f.input, postId: '777' }), false);
  assert.equal(
    calls.some((c) => c.url.includes('fixture-token')),
    false,
  );
  await assert.rejects(f.publisher.publish(f.input), /already attempted/);
});
test('processing delay retains upload ID and never retries a publish', async () => {
  let mutations = 0;
  const f = publishing('instagram', async (_, init) => {
    if (init.method === 'POST') {
      mutations++;
      return reply({ id: '888' });
    }
    return reply({ id: '888', status_code: 'IN_PROGRESS' });
  });
  await assert.rejects(f.publisher.publish(f.input), /reconciliation/);
  assert.deepEqual(f.stages, [{ stage: 'upload', id: '888' }]);
  await assert.rejects(f.publisher.publish(f.input), /already attempted/);
  assert.equal(mutations, 1);
});
test('Facebook uploads exact checksum-bound bytes and rejects hostile upload host before token transfer', async () => {
  let uploaded = false;
  const f = publishing('facebook', async (url, init) => {
    if (String(url).includes('rupload.')) {
      uploaded = true;
      assert.equal(init.headers.file_size, '12');
      assert.deepEqual(init.body, bytes);
      return reply({ success: true });
    }
    if (init.method === 'POST' && init.body.includes('upload_phase=start'))
      return reply({
        video_id: '888',
        upload_url: 'https://rupload.facebook.com/video-upload/v23.0/888',
      });
    if (init.method === 'POST') return reply({ success: true });
    return reply({ data: [{ id: '888', description: f.input.caption, published: true }] });
  });
  assert.deepEqual(await f.publisher.publish(f.input), { postId: '888' });
  assert.equal(uploaded, true);
  assert.equal(await f.publisher.verify({ ...f.input, postId: '888' }), true);
  const bad = publishing('facebook', async () =>
    reply({ video_id: '888', upload_url: 'https://hostile.example/x' }),
  );
  await assert.rejects(bad.publisher.publish(bad.input), /URL refused/);
});
test('LinkedIn multipart uploads cover bytes, omit bearer on presigned URL, and bind post readback to video', async () => {
  const f = publishing('linkedin', async (url, init) => {
    const path = String(url);
    if (path.includes('initializeUpload'))
      return reply({
        value: {
          video: 'urn:li:video:fixture',
          uploadToken: '',
          uploadUrlsExpireAt: now().getTime() + 60000,
          uploadInstructions: [
            { firstByte: 0, lastByte: 5, uploadUrl: 'https://www.linkedin.com/dms-uploads/first' },
            {
              firstByte: 6,
              lastByte: 11,
              uploadUrl: 'https://www.linkedin.com/dms-uploads/second',
            },
          ],
        },
      });
    if (path.includes('/dms-uploads/')) {
      assert.equal(init.headers.Authorization, undefined);
      assert.equal(init.body.length, 6);
      return new Response(null, { headers: { etag: 'fixture-part' } });
    }
    assert.equal(init.headers['Linkedin-Version'], '202609');
    if (path.includes('finalizeUpload')) {
      assert.deepEqual(JSON.parse(init.body).finalizeUploadRequest.uploadedPartIds, [
        'fixture-part',
        'fixture-part',
      ]);
      return new Response(null);
    }
    if (path.includes('/videos/'))
      return reply({
        id: 'urn:li:video:fixture',
        owner: 'urn:li:person:fixture',
        status: 'AVAILABLE',
      });
    if (init.method === 'POST')
      return new Response(null, {
        status: 201,
        headers: { 'x-restli-id': 'urn:li:share:fixture' },
      });
    return reply({
      id: 'urn:li:share:fixture',
      author: 'urn:li:person:fixture',
      commentary: f.input.caption,
      lifecycleState: 'PUBLISHED',
      visibility: 'PUBLIC',
      content: { media: { id: 'urn:li:video:fixture' } },
    });
  });
  assert.deepEqual(await f.publisher.publish(f.input), { postId: 'urn:li:share:fixture' });
  assert.equal(await f.publisher.verify({ ...f.input, postId: 'urn:li:share:fixture' }), true);
});
function oauthFixture(overrides = {}) {
  const key = new Uint8Array(32).fill(3);
  const flows = new Map();
  const saved = [];
  let exchanges = 0;
  const options = {
    enabled: () => true,
    transport: async (url) => {
      if (String(url).includes('accessToken')) {
        exchanges++;
        return reply({
          access_token: 'fixture-token',
          expires_in: 3600,
          scope: 'openid profile w_member_social r_member_social',
        });
      }
      return reply({ sub: 'fixture' });
    },
    now,
    key,
    origin: 'https://agentgrid.me',
    metaVersion: 'v23.0',
    credentials: async () => ({ clientId: 'fixture-client', clientSecret: 'fixture-secret' }),
    store: {
      create: async (v) => flows.set(v.digest, v),
      consume: async (digest, owner, session, platform) => {
        const v = flows.get(digest);
        if (!v || v.ownerId !== owner || v.sessionDigest !== session || v.platform !== platform)
          return null;
        flows.delete(digest);
        return v;
      },
      connect: async (v) => saved.push(v),
    },
    ...overrides,
  };
  return { oauth: socialOAuth(options), key, saved, exchanges: () => exchanges };
}
test('OAuth is one-use and session-bound; only server-verified accounts and encrypted secrets are saved', async () => {
  const f = oauthFixture();
  const session = 'a'.repeat(64);
  const start = await f.oauth.start(ownerId, session, 'linkedin');
  const state = new URL(start.authorizationUrl).searchParams.get('state');
  const input = {
    ownerId,
    sessionDigest: session,
    platform: 'linkedin',
    state,
    code: 'fixture-code',
    signal: signal(),
  };
  await assert.rejects(f.oauth.complete({ ...input, sessionDigest: 'b'.repeat(64) }));
  assert.equal(f.exchanges(), 0);
  const result = await f.oauth.complete(input);
  assert.equal(result.connections.length, 1);
  assert.equal(f.saved[0].accountId, 'urn:li:person:fixture');
  const tokens = await openSocialTokens(
    f.key,
    { ownerId, connectionId: f.saved[0].id, platform: 'linkedin' },
    f.saved[0].sealedTokens,
    now(),
  );
  assert.equal(tokens.accessToken, 'fixture-token');
  assert.equal(JSON.stringify(result).includes('fixture-token'), false);
  await assert.rejects(f.oauth.complete(input));
  assert.equal(f.exchanges(), 1);
});
test('OAuth refusal consumes state without exchanging a code; disabled OAuth has no side effects', async () => {
  const f = oauthFixture();
  const session = 'a'.repeat(64);
  const start = await f.oauth.start(ownerId, session, 'facebook');
  const input = {
    ownerId,
    sessionDigest: session,
    platform: 'facebook',
    state: new URL(start.authorizationUrl).searchParams.get('state'),
    denied: true,
    signal: signal(),
  };
  assert.deepEqual(await f.oauth.complete(input), { connections: [] });
  assert.equal(f.exchanges(), 0);
  await assert.rejects(f.oauth.complete(input));
  await assert.rejects(
    oauthFixture({ enabled: () => false }).oauth.start(ownerId, session, 'linkedin'),
    /disabled/,
  );
});
test('wrong owner, expired connection, changed checksum and missing read permission fail before mutation', async () => {
  const forbidden = async () => {
    throw new Error('Unexpected provider call');
  };
  const bad = publishing('linkedin', forbidden, {
    connection: async () => ({
      id: connectionId,
      ownerId,
      platform: 'linkedin',
      accountId: 'urn:li:person:fixture',
      accessToken: 'fixture',
      expiresAt: '2026-10-11T12:00:00Z',
      publishingEnabled: true,
      scopes: ['w_member_social'],
    }),
  });
  await assert.rejects(bad.publisher.publish(bad.input), /permissions/);
  const mismatch = publishing('facebook', forbidden, { bytes: async () => new Uint8Array(12) });
  await assert.rejects(mismatch.publisher.publish(mismatch.input), /checksum/);
});

test('encrypted media grants expire, reject tampering and stay off without secret access', async () => {
  const { issueMediaGrant, openMediaGrant } =
    await import('../backend/integrations/media-grant.ts');
  const { providerMediaHandler } = await import('../backend/http/provider-media.ts');
  const key = new Uint8Array(32).fill(8);
  const input = {
    enabled: () => true,
    key,
    subject: ownerId,
    connectionId,
    asset,
    now: now(),
    seconds: 600,
  };
  const token = await issueMediaGrant(input);
  assert.equal(token.includes(ownerId), false);
  assert.deepEqual((await openMediaGrant(key, token, now())).asset, asset);
  await assert.rejects(openMediaGrant(key, token, new Date(now().getTime() + 600000)));
  await assert.rejects(openMediaGrant(key, token.slice(0, -2) + 'ff', now()));
  await assert.rejects(issueMediaGrant({ ...input, enabled: () => false }), /disabled/);
  let called = false;
  const response = await providerMediaHandler('https://agentgrid.me', {}, async () => {
    called = true;
    throw new Error('Unexpected request');
  })(new Request('https://agentgrid.me/api/social/media/?grant=' + token));
  assert.equal(response.status, 503);
  assert.equal(called, false);
});

test('trusted decoder receives bytes only through an approved TLS origin and disabled probe makes no calls', async () => {
  const { remoteVideoProbe } = await import('../backend/integrations/video-probe.ts');
  let calls = 0;
  const options = {
    enabled: () => true,
    origin: 'https://probe.example',
    allowedHosts: ['probe.example'],
    key: async () => 'f'.repeat(32),
    transport: async (url, init) => {
      calls++;
      assert.equal(url, 'https://probe.example/inspect');
      assert.equal(init.redirect, 'manual');
      assert.deepEqual(init.body, bytes);
      return reply({
        width: 720,
        height: 1280,
        seconds: 10,
        videoCodec: 'h264',
        audioCodec: 'aac',
      });
    },
  };
  assert.equal((await remoteVideoProbe(options).inspect(bytes)).videoCodec, 'h264');
  await assert.rejects(
    remoteVideoProbe({ ...options, enabled: () => false }).inspect(bytes),
    /disabled/,
  );
  assert.equal(calls, 1);
  assert.throws(
    () => remoteVideoProbe({ ...options, origin: 'https://probe.example@hostile.example' }),
    /refused/,
  );
});

test('Meta OAuth discovers only controlled pages with granted scope and stores page tokens encrypted', async () => {
  const f = oauthFixture({
    transport: async (url) => {
      const path = String(url);
      if (path.includes('/oauth/access_token'))
        return reply({ access_token: 'user-fixture-token', expires_in: 3600 });
      if (path.includes('permissions'))
        return reply({
          data: [
            'pages_show_list',
            'pages_read_engagement',
            'instagram_basic',
            'instagram_content_publish',
          ].map((permission) => ({ permission, status: 'granted' })),
        });
      return reply({
        data: [
          {
            id: '123',
            access_token: 'page-fixture-token',
            tasks: ['CREATE_CONTENT'],
            instagram_business_account: { id: '456' },
          },
          {
            id: '789',
            access_token: 'excluded',
            tasks: ['ANALYZE'],
            instagram_business_account: { id: '789' },
          },
        ],
      });
    },
  });
  const session = 'a'.repeat(64);
  const started = await f.oauth.start(ownerId, session, 'instagram');
  await f.oauth.complete({
    ownerId,
    sessionDigest: session,
    platform: 'instagram',
    state: new URL(started.authorizationUrl).searchParams.get('state'),
    code: 'fixture-code',
    signal: signal(),
  });
  assert.equal(f.saved.length, 1);
  assert.equal(f.saved[0].accountId, '456');
  const tokens = await openSocialTokens(
    f.key,
    { ownerId, connectionId: f.saved[0].id, platform: 'instagram' },
    f.saved[0].sealedTokens,
    now(),
  );
  assert.equal(tokens.accessToken, 'page-fixture-token');
});

test('private dispatch does nothing while execution is disabled even with individual flags on', async () => {
  const { dispatchMediaJob } = await import('../backend/integrations/dispatch.ts');
  let calls = 0;
  for (const kind of ['render', 'inspect', 'publish', 'reconcile'])
    await dispatchMediaJob(
      { kind, subject: ownerId, id: runId, digest: 'a'.repeat(64) },
      {
        AGENTGRID_EXECUTION_ENABLED: '0',
        AGENTGRID_REEL_GENERATION_ENABLED: '1',
        AGENTGRID_SOCIAL_PUBLISHING_ENABLED: '1',
      },
      {
        transport: async () => {
          calls++;
          throw new Error('Unexpected network');
        },
      },
    );
  assert.equal(calls, 0);
});

test('explicit continuation reuses a pending Instagram container and concurrent continuations publish once', async () => {
  let ready = false;
  let creations = 0;
  let publications = 0;
  const f = publishing('instagram', async (url, init) => {
    if (String(url).includes('media_publish')) {
      publications++;
      return reply({ id: '999' });
    }
    if (init.method === 'POST') {
      creations++;
      return reply({ id: '888' });
    }
    return reply({ id: '888', status_code: ready ? 'FINISHED' : 'IN_PROGRESS' });
  });
  await assert.rejects(f.publisher.publish(f.input), /reconciliation/);
  ready = true;
  const outcomes = await Promise.allSettled([
    f.publisher.resume(f.input),
    f.publisher.resume(f.input),
  ]);
  assert.equal(outcomes.filter((v) => v.status === 'fulfilled').length, 1);
  assert.equal(creations, 1);
  assert.equal(publications, 1);
  await assert.rejects(f.publisher.resume(f.input), /resumable/);
});
