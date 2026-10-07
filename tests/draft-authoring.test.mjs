import test from 'node:test';
import assert from 'node:assert/strict';
import { newDraft, parseDraftSpecification } from '../src/domain/draft.ts';
import { parseAgentSpecification } from '../src/domain/agent-specification.ts';
import { workspaceData } from '../backend/workspace/data.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';

const resourceId = '20000000-0000-4000-8000-000000000001';
const draft = () =>
  newDraft('Synthetic private authoring', 'synthetic-private-authoring', 'everyday', 'chatgpt');
test('incomplete private drafts retain explicit unselected rights and cannot pass publication validation', () => {
  const value = draft();
  assert.equal(value.execution.instructions, '');
  assert.deepEqual(value.examples, []);
  assert.equal(value.license.identifier, 'unselected');
  assert.ok(Object.values(value.license.permissions).every((item) => item === false));
  assert.throws(() => parseAgentSpecification(value));
  for (const changed of [
    { ...value, owner_id: 'forged' },
    { ...value, category: 'invented' },
    { ...value, platforms: [...value.platforms, ...value.platforms] },
    {
      ...value,
      permissions: [
        {
          resource: 'Synthetic',
          operation: 'write',
          justification: '',
          confirmation_required: false,
        },
      ],
    },
    {
      ...value,
      license: {
        ...value.license,
        permissions: { use: true, modify: true, redistribute: true, public_fork: true },
      },
    },
    { ...value, identity: { ...value.identity, slug: 'submit' } },
    { ...value, extensions: JSON.parse('{"x_fixture":{"__proto__":{"leak":true}}}') },
    { ...value, purpose: 'a'.repeat(1801) },
  ])
    assert.throws(() => parseDraftSpecification(changed));
});
function dataFixture() {
  const configuration = syntheticConfiguration();
  const profile = {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'synthetic_owner',
    displayName: 'Synthetic owner',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  };
  const session = {
    subject: '00000000-0000-4000-8000-000000000001',
    accessToken: 'synthetic-bearer',
    refreshToken: 'synthetic-refresh',
    expiresAt: 123456789,
  };
  const state = {
    specification: draft(),
    editorial: { retained: 'Private review context' },
    revision: 1,
    ownerMatch: true,
    status: 'active',
    failure: null,
    acknowledgement: null,
  };
  const calls = [];
  const data = workspaceData(configuration, session, async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), configuration.publishableKey);
    assert.equal(headers.get('authorization'), 'Bearer ' + session.accessToken);
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.pathname.endsWith('/agentgrid_workspace_identity'))
      return Response.json({
        profile,
        roles: ['moderator'],
        onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
      });
    if (url.pathname.endsWith('/agentgrid_agents'))
      return Response.json(
        state.ownerMatch
          ? {
              id: resourceId,
              slug: state.specification.identity.slug,
              status: state.status,
              forked_from_version_id: null,
            }
          : null,
      );
    if (url.pathname.endsWith('/agentgrid_drafts'))
      return Response.json({
        specification: state.specification,
        editorial: state.editorial,
        revision: state.revision,
        updated_at: '2026-10-07T01:00:00Z',
      });
    if (state.failure) return Response.json(state.failure, { status: 400 });
    if (url.pathname.endsWith('/agentgrid_create_agent')) {
      assert.equal(body.source_version_id, null);
      assert.deepEqual(body.initial_editorial, {});
      state.specification = body.initial_specification;
      return Response.json(resourceId);
    }
    if (url.pathname.endsWith('/agentgrid_save_draft')) {
      assert.equal(body.updated_editorial, null);
      assert.equal(body.expected_revision, state.revision);
      state.revision++;
      state.specification = body.updated_specification;
      return Response.json(state.acknowledgement ?? state.revision);
    }
    throw new Error('Unexpected authoring resource');
  });
  return { data, state, calls, profile };
}
test('authoring uses explicit ownership and optimistic revisions; saves preserve editorial data', async () => {
  const { data, state, calls, profile } = dataFixture();
  assert.equal((await data.createDraft(draft())).revision, 1);
  const ownedQuery = calls.find((call) => call.url.pathname.endsWith('/agentgrid_agents'));
  assert.equal(ownedQuery.url.searchParams.get('owner_id'), 'eq.' + profile.id);
  const record = await data.draft(resourceId);
  assert.deepEqual(record.editorial, state.editorial);
  const edited = { ...draft(), purpose: 'Unfinished private notes' };
  assert.deepEqual(await data.saveDraft(resourceId, 1, edited), { revision: 2 });
  assert.deepEqual(state.editorial, { retained: 'Private review context' });
  const writes = () =>
    calls.filter((call) => call.url.pathname.endsWith('/agentgrid_save_draft')).length;
  await assert.rejects(data.saveDraft(resourceId, 1, edited), (error) => error.status === 409);
  assert.equal(writes(), 1);
  await assert.rejects(
    data.saveDraft(resourceId, 2, {
      ...edited,
      identity: { ...edited.identity, slug: 'changed-path' },
    }),
    (error) => error.status === 400,
  );
  state.ownerMatch = false;
  await assert.rejects(data.draft(resourceId), (error) => error.status === 404);
  await assert.rejects(data.saveDraft(resourceId, 2, edited), (error) => error.status === 404);
  assert.equal(writes(), 1);
  state.ownerMatch = true;
  state.status = 'blocked';
  await assert.rejects(data.saveDraft(resourceId, 2, edited), (error) => error.status === 403);
  profile.status = 'suspended';
  await assert.rejects(data.createDraft(draft()), (error) => error.status === 403);
});
test('authoring fails closed on write races, rejected database authority and unconfirmed acknowledgements', async () => {
  const { data, state } = dataFixture();
  state.failure = { code: '40001', message: 'Synthetic private conflict detail' };
  await assert.rejects(
    data.saveDraft(resourceId, 1, draft()),
    (error) => error.status === 409 && error.code === 'conflict',
  );
  assert.equal(state.revision, 1);
  state.failure = { code: '42501', message: 'Synthetic suspension after ownership preflight' };
  await assert.rejects(
    data.saveDraft(resourceId, 1, draft()),
    (error) => error.status === 403 && !error.message.includes('Synthetic'),
  );
  state.failure = null;
  state.acknowledgement = 9;
  await assert.rejects(data.saveDraft(resourceId, 1, draft()), (error) => error.status === 503);
  state.specification = { ...draft(), owner_id: 'forged' };
  await assert.rejects(data.draft(resourceId), (error) => error.status === 503);
  state.specification = draft();
  state.editorial = { notes: 'a'.repeat(32_001) };
  await assert.rejects(data.draft(resourceId), (error) => error.status === 503);
});
test('draft HTTP validates bounded portable input, ignores no forged authorities and requires exact CSRF', async () => {
  const fixture = await identityFixture();
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  const calls = [];
  const record = {
    resourceId,
    revision: 1,
    status: 'active',
    specification: draft(),
    editorial: {},
    sourceVersionId: null,
    updatedAt: '2026-10-07T01:00:00Z',
  };
  const handler = workspaceHandler(fixture.runtime, () => ({
    draft: async (id) => {
      calls.push(id);
      return record;
    },
    createDraft: async (value) => {
      calls.push(value);
      return record;
    },
    saveDraft: async (...values) => {
      calls.push(values);
      return { revision: 2 };
    },
  }));
  const make = (path, body, csrf = verified.data.csrf) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...fixture.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin: identityOrigin,
        'content-type': 'application/json',
        'x-agentgrid-csrf': csrf,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal(
    (await handler(make('/api/workspace/create/', { specification: draft() }))).status,
    201,
  );
  assert.equal((await handler(make('/api/workspace/draft/?resourceId=' + resourceId))).status, 200);
  assert.equal(
    (
      await handler(
        make('/api/workspace/draft/', { resourceId, expectedRevision: 1, specification: draft() }),
      )
    ).status,
    200,
  );
  const before = calls.length;
  for (const body of [
    { specification: draft(), role: 'administrator' },
    { specification: { ...draft(), ownerId: resourceId } },
    { specification: { ...draft(), extensions: JSON.parse('{"x_fixture":{"constructor":{}}}') } },
  ])
    assert.equal((await handler(make('/api/workspace/create/', body))).status, 400);
  assert.equal(
    (await handler(make('/api/workspace/create/', { specification: draft() }, 'forged'))).status,
    403,
  );
  assert.equal(
    (await handler(make('/api/workspace/draft/?resourceId=' + resourceId + '&owner=forged')))
      .status,
    400,
  );
  assert.equal(calls.length, before);
});
