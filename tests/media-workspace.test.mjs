import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaWorkspaceHandler } from '../backend/http/media-workspace.ts';
import { enqueueDuePublications } from '../backend/integrations/scheduler.ts';
import { MediaOverviewSchema, PublicationPreviewSchema } from '../src/domain/media-workspace.ts';
import { identityFixture, identityOrigin, syntheticSubject } from './fixtures/identity.mjs';
const owner = crypto.randomUUID();
const id = crypto.randomUUID();
const member = {
  profile: {
    id: owner,
    username: 'synthetic_member',
    displayName: 'Synthetic member',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  },
  roles: [],
  onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
};
const overview = {
  observedAt: '2026-10-10T10:00:00Z',
  capabilities: { connect: true, render: true, publish: true, schedule: true },
  budget: { limitMicros: 0, heldMicros: 0, spentMicros: 0 },
  siteBudget: { limitMicros: 0, heldMicros: 0, spentMicros: 0 },
  sources: [],
  connections: [],
  reels: [],
  publications: [],
};
const environment = () => ({
  AGENTGRID_EXECUTION_ENABLED: '0',
  AGENTGRID_REEL_GENERATION_ENABLED: '0',
  AGENTGRID_SOCIAL_PUBLISHING_ENABLED: '0',
  AGENTGRID_SOCIAL_OAUTH_ENABLED: '0',
  AGENTGRID_SOCIAL_SCHEDULER_ENABLED: '0',
  AGENTGRID_STAGE: 'production',
  AGENTGRID_ORIGIN: identityOrigin,
  NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(24),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(24),
});
test('workspace reads are private and owned; off flags block approval and queue, but permit revocation', async () => {
  const fixture = await identityFixture();
  let queued = 0;
  const operations = [];
  let active = true;
  const transport = async (url, init) => {
    if (String(url).endsWith('agentgrid_workspace_identity'))
      return Response.json(active ? member : { ...member, profile: null });
    const payload = JSON.parse(init.body);
    assert.equal(payload.actor_user_id, syntheticSubject);
    operations.push(payload.operation);
    return Response.json(payload.operation === 'overview' ? overview : null);
  };
  const env = { ...environment(), AGENTGRID_EXECUTION_QUEUE: { send: async () => queued++ } };
  const handler = mediaWorkspaceHandler(fixture.runtime, env, transport);
  const make = (path, body, csrf, origin = identityOrigin) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...fixture.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin,
        'content-type': 'application/json',
        ...(csrf ? { 'x-agentgrid-csrf': csrf } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await handler(make('/api/media/'))).status, 401);
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  const response = await handler(make('/api/media/'));
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.deepEqual((await response.json()).capabilities, {
    connect: false,
    render: false,
    publish: false,
    schedule: false,
  });
  assert.equal(
    (
      await handler(
        make(
          '/api/media/approve-reel/',
          { id, digest: 'a'.repeat(64), confirmed: true },
          verified.data.csrf,
        ),
      )
    ).status,
    503,
  );
  assert.equal(queued, 0);
  assert.equal(
    (await handler(make('/api/media/disable-connection/', { id }, verified.data.csrf))).status,
    200,
  );
  assert.equal(operations.at(-1), 'disable-connection');
  assert.equal(
    (await handler(make('/api/media/cancel-publication/', { id }, verified.data.csrf))).status,
    200,
  );
  assert.equal((await handler(make('/api/media/disable-connection/', { id }))).status, 403);
  assert.equal(
    (
      await handler(
        make(
          '/api/media/disable-connection/',
          { id },
          verified.data.csrf,
          'https://hostile.example',
        ),
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await handler(
        make('/api/media/disable-connection/', { id, ownerId: owner }, verified.data.csrf),
      )
    ).status,
    400,
  );
  active = false;
  assert.equal((await handler(make('/api/media/'))).status, 403);
});
test('scheduler does nothing until all flags are on; due jobs come only from bounded private RPC', async () => {
  let calls = 0;
  const forbidden = async () => {
    calls++;
    throw new Error('Unexpected request');
  };
  await enqueueDuePublications(environment(), forbidden);
  await enqueueDuePublications(
    {
      ...environment(),
      AGENTGRID_EXECUTION_ENABLED: '1',
      AGENTGRID_SOCIAL_PUBLISHING_ENABLED: '1',
    },
    forbidden,
  );
  assert.equal(calls, 0);
  const sent = [];
  const env = {
    ...environment(),
    AGENTGRID_EXECUTION_ENABLED: '1',
    AGENTGRID_SOCIAL_PUBLISHING_ENABLED: '1',
    AGENTGRID_SOCIAL_SCHEDULER_ENABLED: '1',
    AGENTGRID_EXECUTION_QUEUE: { send: async (job) => sent.push(job) },
  };
  await enqueueDuePublications(env, async (url, init) => {
    assert.equal(url, 'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_due_social_jobs');
    assert.equal(init.redirect, 'manual');
    return Response.json([
      { kind: 'publish', subject: syntheticSubject, id, digest: 'a'.repeat(64) },
    ]);
  });
  assert.equal(sent.length, 1);
  await assert.rejects(
    enqueueDuePublications(env, async () =>
      Response.json([
        {
          kind: 'publish',
          subject: syntheticSubject,
          id,
          digest: 'a'.repeat(64),
          caption: 'Injected',
        },
      ]),
    ),
  );
  assert.equal(sent.length, 1);
});
test('browser overview rejects credentials and publication captions are constrained per platform', () => {
  assert.equal(
    MediaOverviewSchema.safeParse({ ...overview, sealedTokens: 'secret' }).success,
    false,
  );
  const preview = {
    runId: id,
    revision: 1,
    mediaId: id,
    mediaSha256: 'a'.repeat(64),
    scheduledAt: '2026-10-10T12:00:00Z',
    destinations: [{ platform: 'instagram', connectionId: id, caption: 'a'.repeat(2201) }],
  };
  assert.equal(PublicationPreviewSchema.safeParse(preview).success, false);
  assert.equal(
    PublicationPreviewSchema.safeParse({
      ...preview,
      destinations: [{ ...preview.destinations[0], platform: 'linkedin' }],
    }).success,
    true,
  );
});
