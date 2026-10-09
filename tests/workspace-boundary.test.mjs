import test from 'node:test';
import assert from 'node:assert/strict';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { workspaceData } from '../backend/workspace/data.ts';

test('workspace HTTP requires a verified session and exact CSRF; caller roles/owners are rejected', async () => {
  const fixture = await identityFixture();
  const calls = [];
  const snapshot = {
    profile: null,
    roles: [],
    onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
  };
  const handle = workspaceHandler(fixture.runtime, (session) => {
    calls.push(['session', session.subject]);
    return {
      identity: async () => snapshot,
      agents: async (offset) => ({ agents: [], hasMore: false, offset }),
      saved: async (offset) => {
        calls.push(['saved', offset]);
        return { agents: [], hasMore: false, offset };
      },
      saveState: async (id) => {
        calls.push(['save-state', id]);
        return { saved: true, available: false };
      },
      onboard: async (input) => {
        calls.push(['onboard', input]);
      },
      updateProfile: async (input) => {
        calls.push(['profile', input]);
      },
      visibility: async (value) => {
        calls.push(['visibility', value]);
      },
      favorite: async (id, saved) => {
        calls.push(['save', id, saved]);
        return saved;
      },
    };
  });
  const make = (path, body, headers = {}) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...fixture.jar].map(([key, value]) => key + '=' + value).join('; '),
        origin: identityOrigin,
        'content-type': 'application/json',
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await handle(make('/api/workspace/'))).status, 401);
  assert.equal(calls.length, 0);
  const bootstrap = await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' });
  assert.deepEqual(await (await handle(make('/api/workspace/'))).json(), snapshot);
  assert.equal(
    (await handle(make('/api/workspace/profile/', { displayName: 'Owner', bio: '', website: '' })))
      .status,
    403,
  );
  assert.equal(
    (
      await handle(
        make(
          '/api/workspace/profile/',
          { displayName: 'Owner', bio: '', website: '' },
          { 'x-agentgrid-csrf': bootstrap.data.csrf },
        ),
      )
    ).status,
    403,
  );
  const headers = { 'x-agentgrid-csrf': verified.data.csrf };
  assert.equal(
    (
      await handle(
        make(
          '/api/workspace/profile/',
          { displayName: 'Owner', bio: '', website: '', role: 'administrator', ownerId: 'forged' },
          headers,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        make(
          '/api/workspace/profile/',
          { displayName: 'Owner', bio: '', website: 'https://user:password@attacker.test' },
          headers,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        make('/api/workspace/profile/', { displayName: 'Owner', bio: '', website: '' }, headers),
      )
    ).status,
    200,
  );
  assert.equal((await handle(make('/api/workspace/agents/?offset=20'))).status, 200);
  for (const path of [
    '/api/workspace/agents/?offset=-1',
    '/api/workspace/agents/?owner=forged',
    '/api/workspace/agents/?offset=0&offset=20',
  ])
    assert.equal((await handle(make(path))).status, 400);
  const savedResponse = await handle(make('/api/workspace/saved/?offset=20'));
  assert.equal(savedResponse.status, 200);
  assert.equal(savedResponse.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(await savedResponse.json(), { agents: [], hasMore: false, offset: 20 });
  const resourceId = '20000000-0000-4000-8000-000000000001';
  assert.deepEqual(
    await (await handle(make('/api/workspace/favorite/?resourceId=' + resourceId))).json(),
    { saved: true, available: false },
  );
  const prior = calls.length;
  for (const path of [
    '/api/workspace/saved/?offset=10000',
    '/api/workspace/saved/?offset=-1',
    '/api/workspace/saved/?offset=0&offset=20',
    '/api/workspace/saved/?owner=forged',
    '/api/workspace/favorite/',
    '/api/workspace/favorite/?resourceId=forged',
    '/api/workspace/favorite/?resourceId=' + resourceId + '&owner=forged',
    '/api/workspace/favorite/?resourceId=' + resourceId + '&resourceId=' + resourceId,
  ])
    assert.equal((await handle(make(path))).status, 400);
  assert.ok(calls.slice(prior).every(([action]) => action === 'session'));
  assert.equal((await handle(make('/api/workspace/saved/', {}, headers))).status, 405);
  assert.equal(
    (await handle(make('/api/workspace/saved/', undefined, { 'sec-fetch-site': 'cross-site' })))
      .status,
    403,
  );
  assert.equal(
    (await handle(make('/api/workspace/favorite/', { resourceId, saved: false }, headers))).status,
    200,
  );
  assert.deepEqual(calls.at(-1), ['save', resourceId, false]);
});
test('workspace uses publishable key plus the verified bearer, explicit owner filters and live membership', async () => {
  const configuration = syntheticConfiguration(),
    requests = [];
  const profile = {
    id: '10000000-0000-4000-8000-000000000001',
    username: 'fixture_owner',
    displayName: 'Fixture owner',
    bio: '',
    website: null,
    visibility: 'private',
    status: 'active',
  };
  const snapshot = {
    profile,
    roles: [],
    onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
  };
  const session = {
    subject: '00000000-0000-4000-8000-000000000001',
    accessToken: 'synthetic-access-token-for-workspace',
    refreshToken: 'synthetic-refresh-token-for-workspace',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
  const transport = async (input, init) => {
    const url = new URL(String(input)),
      headers = new Headers(init.headers);
    requests.push(url);
    assert.equal(headers.get('apikey'), configuration.publishableKey);
    assert.equal(headers.get('authorization'), 'Bearer ' + session.accessToken);
    assert.equal(init.redirect, 'manual');
    if (url.pathname === '/rest/v1/rpc/agentgrid_workspace_identity')
      return Response.json(snapshot);
    if (url.pathname === '/rest/v1/agentgrid_agents') return Response.json([]);
    if (url.pathname === '/rest/v1/rpc/agentgrid_update_profile') {
      assert.deepEqual(JSON.parse(init.body), {
        requested_display_name: 'Owner',
        requested_bio: '',
        requested_website: null,
      });
      return Response.json(profile.id);
    }
    if (url.pathname === '/rest/v1/rpc/agentgrid_set_favorite')
      return Response.json(JSON.parse(init.body).saved);
    throw new Error('Unexpected application resource');
  };
  const data = workspaceData(configuration, session, transport);
  assert.deepEqual(await data.agents(0), { agents: [], hasMore: false, offset: 0 });
  assert.equal(
    requests.find((url) => url.pathname.endsWith('/agentgrid_agents')).searchParams.get('owner_id'),
    'eq.' + profile.id,
  );
  await data.updateProfile({ displayName: 'Owner', bio: '', website: '' });
  assert.ok(requests.some((url) => url.pathname.endsWith('/agentgrid_update_profile')));
  assert.equal(await data.favorite('20000000-0000-4000-8000-000000000001', true), true);
  await assert.rejects(
    data.onboard({
      username: 'fixture_new',
      displayName: 'New',
      termsVersion: 'invented',
      privacyVersion: 'invented',
      acceptsTerms: true,
      acknowledgesPrivacy: true,
    }),
    (error) => error.code === 'terms-required',
  );
  snapshot.profile.status = 'suspended';
  await assert.rejects(
    data.updateProfile({ displayName: 'Owner', bio: '', website: '' }),
    (error) => error.code === 'request-refused',
  );
  assert.ok(
    requests.every(
      (url) =>
        url.pathname.startsWith('/rest/v1/agentgrid_') ||
        url.pathname.startsWith('/rest/v1/rpc/agentgrid_'),
    ),
  );
});
