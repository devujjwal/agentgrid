import test from 'node:test';
import assert from 'node:assert/strict';
import { workspaceData } from '../backend/workspace/data.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';

const profileId = '10000000-0000-4000-8000-000000000001';
const targetId = '20000000-0000-4000-8000-000000000001';
const reportId = '40000000-0000-4000-8000-000000000001';
const date = '2026-10-07T00:00:00Z';
const input = {
  targetKind: 'agent',
  targetId,
  category: 'privacy',
  explanation: 'Synthetic private report explains a specific privacy concern for boundary testing.',
};
const row = {
  id: reportId,
  ...input,
  state: 'open',
  resolution: '',
  resolvedAt: null,
  createdAt: date,
};
const fails = (status) => (error) => error.status === status;

function fixture() {
  const configuration = syntheticConfiguration(),
    calls = [];
  const state = {
    active: true,
    ledger: [],
    confirmation: [row],
    acknowledgement: reportId,
    failure: null,
  };
  const data = workspaceData(
    configuration,
    { accessToken: 'synthetic-report-bearer' },
    async (raw, init) => {
      const url = new URL(String(raw)),
        headers = new Headers(init.headers),
        body = init.body ? JSON.parse(init.body) : null;
      assert.equal(headers.get('apikey'), configuration.publishableKey);
      assert.equal(headers.get('authorization'), 'Bearer synthetic-report-bearer');
      calls.push({ name: url.pathname.split('/').at(-1), body });
      if (url.pathname.endsWith('/agentgrid_workspace_identity'))
        return Response.json({
          profile: {
            id: profileId,
            username: 'report_fixture',
            displayName: 'Synthetic reporter',
            bio: '',
            website: null,
            visibility: 'private',
            status: state.active ? 'active' : 'suspended',
          },
          roles: ['administrator'],
          onboarding: { enabled: false, termsVersion: null, privacyVersion: null },
        });
      if (url.pathname.endsWith('/agentgrid_owned_reports'))
        return Response.json(body.report_resource_id === null ? state.ledger : state.confirmation);
      if (url.pathname.endsWith('/agentgrid_create_report')) {
        if (state.failure) return Response.json(state.failure, { status: 400 });
        return Response.json(state.acknowledgement);
      }
      throw new Error('Unexpected synthetic report transport');
    },
  );
  return { state, calls, data };
}
test('private reports use verified bearer authority, bounded lookahead and strict projections with no staff override', async () => {
  const { state, calls, data } = fixture();
  assert.deepEqual(await data.reports(0), { reports: [], hasMore: false, offset: 0 });
  state.ledger = Array.from({ length: 21 }, (_, index) => ({
    ...row,
    id: '40000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'),
  }));
  const history = await data.reports(20);
  assert.equal(history.reports.length, 20);
  assert.equal(history.hasMore, true);
  assert.deepEqual(calls.at(-1).body, { requested_offset: 20, report_resource_id: null });
  for (const malformed of [
    [row, row],
    Array.from({ length: 22 }, () => row),
    [{ ...row, reporterEmail: 'private@example.test' }],
    [{ ...row, state: 'resolved', resolvedAt: null }],
    [{ ...row, state: 'open', resolution: 'Undocumented moderation details' }],
  ]) {
    state.ledger = malformed;
    await assert.rejects(data.reports(0), fails(503));
  }
  state.active = false;
  const before = calls.length;
  await assert.rejects(data.reports(0), fails(403));
  assert.equal(calls.length, before + 1);
});
test('report acknowledgement confirms immutable target/content and returns actual live resolution state', async () => {
  const { state, calls, data } = fixture();
  assert.deepEqual(await data.createReport(input), row);
  assert.deepEqual(calls.find((call) => call.name === 'agentgrid_create_report').body, {
    target_kind: 'agent',
    target_id: targetId,
    report_category: 'privacy',
    details: input.explanation,
  });
  assert.deepEqual(calls.at(-1).body, { requested_offset: 0, report_resource_id: reportId });
  const resolved = {
    ...row,
    state: 'resolved',
    resolution: 'Synthetic resolution recorded before acknowledgement.',
    resolvedAt: date,
  };
  state.confirmation = [resolved];
  assert.deepEqual(await data.createReport(input), resolved);
  for (const confirmation of [
    [],
    [row, row],
    [{ ...row, id: targetId }],
    [{ ...row, targetKind: 'profile' }],
    [{ ...row, targetId: reportId }],
    [{ ...row, category: 'spam' }],
    [{ ...row, explanation: input.explanation + ' mismatched' }],
  ]) {
    state.confirmation = confirmation;
    await assert.rejects(data.createReport(input), fails(503));
  }
});
test('report writes reject forged authority, unavailable targets, duplicate open reports and quotas without leaking database errors', async () => {
  const { state, data, calls } = fixture();
  await assert.rejects(data.createReport({ ...input, reporterId: profileId }), fails(400));
  assert.equal(calls.filter((call) => call.name === 'agentgrid_create_report').length, 0);
  for (const [code, status] of [
    ['42501', 403],
    ['23505', 409],
    ['P0001', 429],
    ['23514', 400],
    ['XX000', 503],
  ]) {
    state.failure = { code, message: 'Sensitive provider detail never reaches the public error.' };
    await assert.rejects(
      data.createReport(input),
      (error) => error.status === status && !error.message.includes('Sensitive'),
    );
  }
  state.failure = null;
  state.acknowledgement = 'not-a-uuid';
  await assert.rejects(data.createReport(input), fails(503));
  state.active = false;
  await assert.rejects(data.createReport(input), fails(403));
});
test('report HTTP requires verified identity and exact CSRF, bounds fields and conceals histories from cross-origin reads', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = workspaceHandler(identity.runtime, () => ({
    reports: async (offset) => {
      calls.push(['reports', offset]);
      return { reports: [], hasMore: false, offset };
    },
    createReport: async (value) => {
      calls.push(['create', value]);
      return row;
    },
  }));
  const make = (path, body, csrf, extra = {}) =>
    new Request(identityOrigin + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        cookie: [...identity.jar].map(([k, v]) => k + '=' + v).join('; '),
        origin: identityOrigin,
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-AgentGrid-CSRF': csrf } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  assert.equal((await handle(make('/api/workspace/reports/'))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  assert.equal((await handle(make('/api/workspace/report/', input))).status, 403);
  for (const invalid of [
    { ...input, reporterId: profileId },
    { ...input, role: 'administrator' },
    { ...input, state: 'resolved' },
    { ...input, explanation: 'too short' },
    { ...input, targetKind: 'database' },
    { ...input, explanation: 'x'.repeat(2401) },
  ])
    assert.equal((await handle(make('/api/workspace/report/', invalid, csrf))).status, 400);
  for (const query of [
    'offset=-1',
    'offset=10000',
    'offset=0&offset=20',
    'reporterId=' + profileId,
  ])
    assert.equal((await handle(make('/api/workspace/reports/?' + query))).status, 400);
  assert.equal(
    (
      await handle(
        make('/api/workspace/reports/', undefined, undefined, { 'sec-fetch-site': 'cross-site' }),
      )
    ).status,
    403,
  );
  assert.equal((await handle(make('/api/workspace/reports/', {}, csrf))).status, 405);
  const response = await handle(make('/api/workspace/report/', input, csrf));
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.match(response.headers.get('x-robots-tag'), /noindex/);
  const history = await handle(make('/api/workspace/reports/?offset=20'));
  assert.equal(history.status, 200);
  assert.deepEqual(calls, [
    ['create', input],
    ['reports', 20],
  ]);
});
