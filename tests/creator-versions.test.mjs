import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceData } from '../backend/workspace/data.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';
import { publicationFixture } from './fixtures/publication.mjs';
import { isLaterVersion } from '../src/domain/versions.ts';
const resourceId = '20000000-0000-4000-8000-000000000001';
const versionId = '30000000-0000-4000-8000-000000000001';
const profileId = '10000000-0000-4000-8000-000000000001';
const date = '2026-10-07T00:00:00Z';

async function dataFixture() {
  const configuration = syntheticConfiguration();
  const state = {
    specification: (await publicationFixture()).specification,
    revision: 3,
    active: true,
    owner: true,
    failure: null,
    immutable: null,
    submission: null,
    ledger: { versions: [], submissionEnabled: false, pendingVersionId: null, latestVersion: null },
    acknowledgement: versionId,
  };
  const calls = [];
  const data = workspaceData(
    configuration,
    { accessToken: 'synthetic-creator-bearer' },
    async (input, init) => {
      const url = new URL(String(input)),
        headers = new Headers(init.headers);
      assert.equal(headers.get('apikey'), configuration.publishableKey);
      assert.equal(headers.get('authorization'), 'Bearer synthetic-creator-bearer');
      const body = init.body ? JSON.parse(init.body) : null;
      calls.push({ url, body });
      if (url.pathname.endsWith('/agentgrid_workspace_identity'))
        return Response.json({
          profile: {
            id: profileId,
            username: 'synthetic_owner',
            displayName: 'Synthetic owner',
            bio: '',
            website: null,
            visibility: 'private',
            status: state.active ? 'active' : 'suspended',
          },
          roles: ['moderator'],
          onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
        });
      if (url.pathname.endsWith('/agentgrid_agents')) {
        assert.equal(url.searchParams.get('owner_id'), 'eq.' + profileId);
        return Response.json(
          state.owner
            ? {
                id: resourceId,
                slug: state.specification.identity.slug,
                status: 'active',
                forked_from_version_id: null,
              }
            : null,
        );
      }
      if (url.pathname.endsWith('/agentgrid_drafts'))
        return Response.json({
          specification: state.specification,
          editorial: {},
          revision: state.revision,
          updated_at: date,
        });
      if (url.pathname.endsWith('/agentgrid_owned_versions')) return Response.json(state.ledger);
      if (url.pathname.endsWith('/agentgrid_submit_version')) {
        if (state.failure) return Response.json(state.failure, { status: 400 });
        state.immutable = {
          id: versionId,
          agent_id: resourceId,
          submitted_by: profileId,
          version: state.specification.version,
          content_digest: 'a'.repeat(64),
          created_at: date,
        };
        state.submission = { state: 'pending', reason: '', reviewed_at: null };
        return Response.json(state.acknowledgement);
      }
      if (url.pathname.endsWith('/agentgrid_agent_versions')) {
        assert.equal(url.searchParams.get('submitted_by'), 'eq.' + profileId);
        assert.equal(url.searchParams.get('agent_id'), 'eq.' + resourceId);
        return Response.json(
          state.owner && url.searchParams.get('id') === 'eq.' + state.immutable?.id
            ? state.immutable
            : null,
        );
      }
      if (url.pathname.endsWith('/agentgrid_submissions')) return Response.json(state.submission);
      if (url.pathname.endsWith('/agentgrid_decide_submission')) {
        if (state.failure) return Response.json(state.failure, { status: 400 });
        assert.equal(body.decision, 'withdrawn');
        state.submission = { state: 'withdrawn', reason: body.explanation, reviewed_at: date };
        return Response.json(null);
      }
      throw new Error('Unexpected synthetic transport');
    },
  );
  return { state, calls, data };
}
const fails = (status, code) => (error) =>
  error.status === status && (!code || error.code === code);
test('creator submission snapshots a complete saved revision, acknowledges immutable ownership and confirms withdrawal', async () => {
  const { state, calls, data } = await dataFixture();
  const submitted = await data.submitVersion(resourceId, 3);
  assert.equal(submitted.id, versionId);
  assert.equal(submitted.state, 'pending');
  assert.deepEqual(calls.find((x) => x.url.pathname.endsWith('/agentgrid_submit_version')).body, {
    resource_id: resourceId,
    expected_revision: 3,
  });
  state.specification.version = '2.0.0';
  const withdrawn = await data.withdrawVersion(
    resourceId,
    versionId,
    'Synthetic creator withdrawal for a revised definition.',
  );
  assert.equal(withdrawn.version, '1.0.0');
  assert.equal(withdrawn.state, 'withdrawn');
  await assert.rejects(
    data.withdrawVersion(resourceId, versionId, 'Synthetic duplicate withdrawal must be refused.'),
    fails(409),
  );
});
test('submission refuses unfinished content, stale revisions, lost ownership, database races and unexpected acknowledgement', async () => {
  for (const [mutate, status, code] of [
    [
      (state) => {
        state.specification.execution.instructions = '';
      },
      400,
      'definition-incomplete',
    ],
    [
      (state) => {
        state.revision = 4;
      },
      409,
      'conflict',
    ],
    [
      (state) => {
        state.owner = false;
      },
      404,
      'not-found',
    ],
    [
      (state) => {
        state.active = false;
      },
      403,
      'request-refused',
    ],
    [
      (state) => {
        state.failure = { code: '40001', message: 'Synthetic private race' };
      },
      409,
      'conflict',
    ],
    [
      (state) => {
        state.failure = { code: '42501', message: 'Synthetic closed submissions' };
      },
      403,
      'request-refused',
    ],
    [
      (state) => {
        state.acknowledgement = 'malformed';
      },
      503,
      'service-unavailable',
    ],
  ]) {
    const { state, data } = await dataFixture();
    mutate(state);
    await assert.rejects(data.submitVersion(resourceId, 3), fails(status, code));
  }
});
test('history is bounded with lookahead and refuses private metadata, duplicate identities or malformed live state', async () => {
  const { state, data } = await dataFixture();
  assert.deepEqual(await data.versions(resourceId, 0), {
    versions: [],
    submissionEnabled: false,
    pendingVersionId: null,
    latestVersion: null,
    hasMore: false,
    offset: 0,
  });
  const row = {
    id: versionId,
    version: '1.0.0',
    contentDigest: 'a'.repeat(64),
    submittedAt: date,
    state: 'pending',
    reason: '',
    reviewedAt: null,
  };
  state.ledger = {
    versions: Array.from({ length: 21 }, (_, i) => ({
      ...row,
      id: '30000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    })),
    submissionEnabled: true,
    pendingVersionId: versionId,
    latestVersion: '1.0.0',
  };
  const history = await data.versions(resourceId, 20);
  assert.equal(history.versions.length, 20);
  assert.equal(history.hasMore, true);
  assert.equal(history.offset, 20);
  for (const versions of [
    [{ ...row, editorial: { private: true } }],
    [row, row],
    [{ ...row, state: 'approved', reviewedAt: null }],
  ]) {
    state.ledger = {
      versions,
      submissionEnabled: true,
      pendingVersionId: versionId,
      latestVersion: '1.0.0',
    };
    await assert.rejects(data.versions(resourceId, 0), fails(503));
  }
});
test('creator version HTTP requires exact session/CSRF and refuses client specification, owner and role authority', async () => {
  const fixture = await identityFixture(),
    calls = [];
  const handle = workspaceHandler(fixture.runtime, () => ({
    submitVersion: async (...args) => {
      calls.push(['submit', ...args]);
      return { id: versionId };
    },
    versions: async (...args) => {
      calls.push(['history', ...args]);
      return { versions: [] };
    },
    withdrawVersion: async (...args) => {
      calls.push(['withdraw', ...args]);
      return { id: versionId };
    },
  }));
  const make = (path, body, csrf) =>
    new Request(identityOrigin + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        cookie: [...fixture.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin: identityOrigin,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-AgentGrid-CSRF': csrf } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  assert.equal(
    (await handle(make('/api/workspace/versions/?resourceId=' + resourceId))).status,
    401,
  );
  await fixture.request('/api/identity/');
  await fixture.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await fixture.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal(
    (await handle(make('/api/workspace/submit/', { resourceId, expectedRevision: 3 }))).status,
    403,
  );
  for (const extra of [{ ownerId: profileId }, { role: 'administrator' }, { specification: {} }])
    assert.equal(
      (
        await handle(
          make('/api/workspace/submit/', { resourceId, expectedRevision: 3, ...extra }, csrf),
        )
      ).status,
      400,
    );
  for (const query of [
    'resourceId=' + resourceId + '&resourceId=' + resourceId,
    'resourceId=' + resourceId + '&offset=-1',
    'resourceId=' + resourceId + '&ownerId=' + profileId,
  ])
    assert.equal((await handle(make('/api/workspace/versions/?' + query))).status, 400);
  const submitted = await handle(
    make('/api/workspace/submit/', { resourceId, expectedRevision: 3 }, csrf),
  );
  assert.equal(submitted.status, 201);
  assert.equal(submitted.headers.get('cache-control'), 'private, no-store');
  assert.equal(
    (await handle(make('/api/workspace/versions/?resourceId=' + resourceId + '&offset=20'))).status,
    200,
  );
  assert.equal(
    (
      await handle(
        make('/api/workspace/withdraw/', { resourceId, versionId, reason: 'too short' }, csrf),
      )
    ).status,
    400,
  );
  assert.equal(
    (
      await handle(
        make(
          '/api/workspace/withdraw/',
          { resourceId, versionId, reason: 'Synthetic creator withdrawal request for acceptance.' },
          csrf,
        ),
      )
    ).status,
    200,
  );
  assert.deepEqual(
    calls.map((x) => x[0]),
    ['submit', 'history', 'withdraw'],
  );
});

test('version advancement matches integer semantics without lexical sorting or unsafe numeric rounding', () => {
  assert.equal(isLaterVersion('1.0.10', '1.0.9'), true);
  assert.equal(isLaterVersion('2.0.0', '1.99.99'), true);
  assert.equal(isLaterVersion('1.0.0', '1.0.0'), false);
  assert.equal(isLaterVersion('1.0.0', '2.0.0'), false);
  assert.equal(isLaterVersion('9007199254740993.0.0', '9007199254740992.0.0'), true);
  assert.equal(isLaterVersion('01.0.0', '1.0.0'), false);
});
