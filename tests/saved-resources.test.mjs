import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceData } from '../backend/workspace/data.ts';
import { syntheticConfiguration } from './fixtures/identity.mjs';

function fixture() {
  const configuration = syntheticConfiguration();
  const profile = {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'synthetic_member',
    displayName: 'Synthetic member',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  };
  const session = {
    subject: '00000000-0000-4000-8000-000000000001',
    accessToken: 'synthetic-user-bearer',
    refreshToken: 'synthetic-refresh',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  const state = { profile, rows: [], saveState: { saved: false, available: true }, failure: null };
  const calls = [];
  const data = workspaceData(configuration, session, async (input, init) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    assert.equal(headers.get('apikey'), configuration.publishableKey);
    assert.equal(headers.get('authorization'), 'Bearer ' + session.accessToken);
    assert.equal(init.redirect, 'manual');
    calls.push({ path: url.pathname, body: JSON.parse(init.body) });
    if (url.pathname.endsWith('/agentgrid_workspace_identity'))
      return Response.json({
        profile: state.profile,
        roles: [],
        onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
      });
    if (state.failure) return Response.json(state.failure, { status: 400 });
    if (url.pathname.endsWith('/agentgrid_saved_agents')) return Response.json(state.rows);
    if (url.pathname.endsWith('/agentgrid_resource_save_state'))
      return Response.json(state.saveState);
    throw new Error('Unexpected resource access');
  });
  return { data, state, calls };
}
const row = (index) => ({
  agent_id: '20000000-0000-4000-8000-' + String(index).padStart(12, '0'),
  saved_at: '2026-10-07T01:00:00+00:00',
  available: true,
  slug: 'synthetic-agent-' + index,
  title: 'Synthetic saved agent ' + index,
  summary:
    'A clearly synthetic resource used only to verify private saved projections and pagination.',
  category_slug: 'productivity',
});
const unavailable = {
  ...row(1),
  available: false,
  slug: null,
  title: null,
  summary: null,
  category_slug: null,
};

test('saved projection uses the member bearer, twenty rows and lookahead; withdrawals hide every content field', async () => {
  const { data, state, calls } = fixture();
  state.rows = [unavailable, ...Array.from({ length: 20 }, (_, i) => row(i + 2))];
  const result = await data.saved(20);
  assert.equal(result.agents.length, 20);
  assert.equal(result.hasMore, true);
  assert.equal(result.offset, 20);
  assert.deepEqual(result.agents[0], {
    resourceId: unavailable.agent_id,
    savedAt: unavailable.saved_at,
    resource: null,
  });
  assert.equal(result.agents[1].resource.title, state.rows[1].title);
  assert.deepEqual(calls.at(-1), {
    path: '/rest/v1/rpc/agentgrid_saved_agents',
    body: { requested_offset: 20 },
  });
  state.rows = [unavailable];
  assert.equal((await data.saved(0)).hasMore, false);
  state.saveState = { saved: true, available: false };
  assert.deepEqual(await data.saveState(unavailable.agent_id), state.saveState);
  assert.deepEqual(calls.at(-1).body, { resource_id: unavailable.agent_id });
});
test('malformed, excessive, or private fields fail closed rather than leaking stale content', async () => {
  const { data, state } = fixture();
  for (const rows of [
    [{ ...unavailable, title: 'Withdrawn private title' }],
    [{ ...row(1), private_notes: 'Unpublished author evidence' }],
    Array.from({ length: 22 }, (_, i) => row(i + 1)),
    [{ ...row(1), slug: '../private' }],
    [{ ...row(1), saved_at: 'malformed' }],
  ]) {
    state.rows = rows;
    await assert.rejects(
      data.saved(0),
      (error) => error.status === 503 && error.code === 'service-unavailable',
    );
  }
  state.saveState = { saved: true, available: true, owner: 'private' };
  await assert.rejects(data.saveState(row(1).agent_id), (error) => error.status === 503);
});
test('missing or revoked membership stops saved queries; database failures have bounded public errors', async () => {
  const { data, state, calls } = fixture();
  for (const profile of [null, { ...state.profile, status: 'suspended' }]) {
    state.profile = profile;
    await assert.rejects(data.saved(0), (error) => error.status === 403);
    await assert.rejects(data.saveState(row(1).agent_id), (error) => error.status === 403);
  }
  assert.ok(calls.every((call) => call.path.endsWith('/agentgrid_workspace_identity')));
  const next = fixture();
  next.state.failure = { code: '42501', message: 'Synthetic private failure text' };
  await assert.rejects(
    next.data.saved(0),
    (error) => error.status === 403 && !error.message.includes('private'),
  );
});
