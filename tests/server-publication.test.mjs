import test from 'node:test';
import assert from 'node:assert/strict';
import { publicationHandler } from '../backend/http/publication.ts';
import { serverPublicationClient } from '../backend/publication/server-client.ts';
import { identityFixture, identityOrigin, syntheticSubject } from './fixtures/identity.mjs';
import { reviewedReleaseFixture } from './fixtures/reviewed-release.mjs';
import { PublicationResultSchema } from '../src/domain/publication-operation.ts';
const id = '50000000-0000-4000-8000-000000000001';
async function setup() {
  const f = await identityFixture();
  f.advance(Math.floor(Date.parse('2026-10-08T00:00:00Z') / 1000) - f.now());
  const { bundle, approval } = await reviewedReleaseFixture();
  let member = { profile: { status: 'active' }, roles: ['administrator'] };
  let released = false,
    lost = false;
  const calls = [];
  const client = {
    rpc: async (name) => {
      calls.push(name);
      if (name === 'agentgrid_execute_release_request') {
        released = true;
        if (lost) return { error: 'PRIVATE provider details', data: null };
      }
      return {
        error: null,
        data:
          name === 'agentgrid_prepare_release_request'
            ? bundle
            : released
              ? { ...approval, state: 'released', decidedAt: '2026-10-08T00:00:00Z' }
              : approval,
      };
    },
  };
  const handler = publicationHandler(
    f.runtime,
    async () => member,
    (subject) => {
      assert.equal(subject, syntheticSubject);
      return client;
    },
    true,
  );
  await f.request('/api/identity/');
  await f.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await f.request('/api/identity/verify/', { code: '12345678' });
  const request = (body, headers = {}, path = '/api/admin/publication/') =>
    new Request(identityOrigin + path, {
      method: 'POST',
      headers: {
        origin: identityOrigin,
        'content-type': 'application/json',
        cookie: [...f.jar].map(([k, v]) => k + '=' + v).join('; '),
        'x-agentgrid-csrf': verified.data.csrf,
        ...headers,
      },
      body: JSON.stringify(body),
    });
  return {
    f,
    bundle,
    calls,
    client,
    handler,
    request,
    setMember: (value) => (member = value),
    lose: () => (lost = true),
  };
}
test('server publication is off by default and rejects non-admin, stale sessions, cross-origin and forged authority', async () => {
  const s = await setup(),
    body = { action: 'prepare', requestId: id };
  const disabled = publicationHandler(
    s.f.runtime,
    async () => {
      throw Error('must not read');
    },
    () => {
      throw Error('must not connect');
    },
    false,
  );
  assert.equal((await disabled(s.request(body))).status, 404);
  for (const member of [
    { profile: null, roles: ['administrator'] },
    { profile: { status: 'active' }, roles: [] },
    { profile: { status: 'active' }, roles: ['moderator'] },
    { profile: { status: 'suspended' }, roles: ['administrator'] },
  ]) {
    s.setMember(member);
    assert.equal((await s.handler(s.request(body))).status, 403);
  }
  s.setMember({ profile: { status: 'active' }, roles: ['administrator'] });
  for (const invalid of [
    { ...body, actor: syntheticSubject },
    { ...body, evidence: {} },
    { action: 'publish', requestId: id },
    { action: 'execute', requestId: id },
  ])
    assert.equal((await s.handler(s.request(invalid))).status, 400);
  assert.equal(
    (await s.handler(s.request(body, { origin: 'https://outside.example' }))).status,
    403,
  );
  assert.equal((await s.handler(s.request(body, { 'x-agentgrid-csrf': 'wrong' }))).status, 403);
  assert.equal(
    (await s.handler(s.request(body, {}, '/api/admin/publication/?action=publish'))).status,
    400,
  );
  s.f.faults.identity = true;
  assert.equal((await s.handler(s.request(body))).status, 401);
  assert.equal(s.calls.length, 0);
});
test('HTTP release prepares persisted evidence, binds fingerprint and redacts private observations', async () => {
  const s = await setup();
  const response = await s.handler(s.request({ action: 'prepare', requestId: id }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const plan = PublicationResultSchema.parse(await response.json());
  assert.match(plan.reviewFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(plan).includes('observed_output'), false);
  assert.equal(
    (await s.handler(s.request({ action: 'publish', requestId: id, fingerprint: 'f'.repeat(64) })))
      .status,
    503,
  );
  assert.equal(s.calls.includes('agentgrid_execute_release_request'), false);
  const released = await s.handler(
    s.request({ action: 'publish', requestId: id, fingerprint: plan.reviewFingerprint }),
  );
  assert.equal(released.status, 200);
  assert.equal((await released.json()).state, 'released');
});
test('failed evidence prevents writes and uncertain acknowledgement requires readback without retry', async () => {
  const s = await setup();
  s.bundle.observations[0].run.assertions[0].passed = false;
  assert.equal((await s.handler(s.request({ action: 'prepare', requestId: id }))).status, 503);
  assert.equal(s.calls.includes('agentgrid_execute_release_request'), false);
  s.bundle.observations[0].run.assertions[0].passed = true;
  const plan = await (await s.handler(s.request({ action: 'prepare', requestId: id }))).json();
  s.lose();
  const lost = await s.handler(
    s.request({ action: 'publish', requestId: id, fingerprint: plan.reviewFingerprint }),
  );
  assert.equal(lost.status, 503);
  assert.deepEqual(await lost.json(), { error: 'service-unavailable' });
  const recovered = await s.handler(s.request({ action: 'inspect', requestId: id }));
  assert.equal((await recovered.json()).state, 'released');
  assert.equal(s.calls.filter((n) => n === 'agentgrid_execute_release_request').length, 1);
});
test('actual SDK server adapter only reaches the bounded RPC and derives actor from the verified session', async () => {
  const config = {
    AGENTGRID_STAGE: 'preview',
    AGENTGRID_ORIGIN: 'https://agentgrid-staging.pages.dev',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(30),
    SUPABASE_SECRET_KEY: 'sb_secret_' + 'b'.repeat(30),
  };
  const calls = [];
  const client = serverPublicationClient(config, syntheticSubject, async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body), redirect: init.redirect });
    return Response.json(null);
  });
  await client.rpc('agentgrid_prepare_release_request', {
    request_id: id,
    actor_user_id: 'forged',
  });
  assert.equal(
    calls[0].url,
    'https://example.supabase.co/rest/v1/rpc/agentgrid_server_publication',
  );
  assert.deepEqual(calls[0].body, {
    actor_user_id: syntheticSubject,
    operation: 'prepare',
    request_id: id,
    evidence: null,
  });
  assert.equal(calls[0].redirect, 'manual');
  await assert.rejects(client.rpc('picmagic_private', { request_id: id }));
  assert.equal(calls.length, 1);
});
