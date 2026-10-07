import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { reportModerationResources } from '../backend/workspace/report-moderation.ts';
import { StaffReportSchema } from '../src/domain/report-moderation.ts';
import { moderationHandler } from '../backend/http/moderation.ts';
import { identityFixture, identityOrigin, syntheticConfiguration } from './fixtures/identity.mjs';

const id = '40000000-0000-4000-8000-000000000001',
  targetId = '20000000-0000-4000-8000-000000000001',
  date = '2026-10-07T00:00:00Z';
const summary = { id, targetKind: 'agent', category: 'privacy', state: 'open', createdAt: date };
const report = {
  ...summary,
  targetId,
  explanation: 'Synthetic report details for isolated staff acceptance only.',
  resolution: '',
  resolvedAt: null,
  conflictOfInterest: false,
  context: null,
};
const input = {
  reportId: id,
  decision: 'resolved',
  explanation: 'Synthetic report resolution recorded for local acceptance only.',
};
const resolved = { ...report, state: 'resolved', resolution: input.explanation, resolvedAt: date };
const fails = (status) => (error) => error.status === status;
function fixture() {
  const config = syntheticConfiguration(),
    calls = [],
    state = { allowed: true, report, queue: [summary], resolved, error: null };
  const client = createClient(config.supabaseOrigin, config.publishableKey, {
    accessToken: async () => 'synthetic-staff-bearer',
    global: {
      fetch: async (raw, init) => {
        const headers = new Headers(init.headers);
        assert.equal(headers.get('apikey'), config.publishableKey);
        assert.equal(headers.get('authorization'), 'Bearer synthetic-staff-bearer');
        const name = new URL(String(raw)).pathname.split('/').at(-1);
        calls.push({ name, body: JSON.parse(init.body) });
        if (state.error) return Response.json(state.error, { status: 400 });
        return Response.json(
          name === 'agentgrid_staff_reports'
            ? state.queue
            : name === 'agentgrid_staff_report'
              ? state.report
              : state.resolved,
        );
      },
    },
  });
  return {
    state,
    calls,
    data: reportModerationResources(client, async () => {
      if (!state.allowed) throw Object.assign(new Error('Staff required'), { status: 403 });
    }),
  };
}
test('report moderation keeps staff authority, projections and queue bounds strict', async () => {
  const { data, state, calls } = fixture();
  assert.deepEqual(await data.staffReport(id), report);
  assert.deepEqual(await data.reportQueue('open', 0), {
    state: 'open',
    offset: 0,
    reports: [summary],
    hasMore: false,
  });
  for (const bad of [
    { ...report, reporterEmail: 'private@example.test' },
    { ...report, id: targetId },
    { ...report, state: 'resolved' },
    {
      ...report,
      context: {
        capturedAt: date,
        snapshot: {
          kind: 'profile',
          username: 'synthetic',
          displayName: 'Synthetic',
          bio: '',
          website: null,
        },
      },
    },
  ]) {
    state.report = bad;
    await assert.rejects(data.staffReport(id), fails(503));
  }
  state.report = null;
  await assert.rejects(data.staffReport(id), fails(404));
  for (const bad of [
    [summary, summary],
    [{ ...summary, state: 'resolved' }],
    [{ ...summary, explanation: 'Confidential detail in summary' }],
  ]) {
    state.queue = bad;
    await assert.rejects(data.reportQueue('open', 0), fails(503));
  }
  state.allowed = false;
  const before = calls.length;
  await assert.rejects(data.staffReport(id), fails(403));
  await assert.rejects(data.reportQueue('open', 0), fails(403));
  await assert.rejects(data.decideReport(input), fails(403));
  assert.equal(calls.length, before);
});
test('snapshot contracts retain reported content and reject draft authority or contradictory versions', async () => {
  const spec = JSON.parse(
    await readFile(
      new URL('../content/agents/inbox-priority-triage/1.0.0.agent.json', import.meta.url),
      'utf8',
    ),
  );
  const context = {
    capturedAt: date,
    snapshot: {
      kind: 'agent',
      slug: spec.identity.slug,
      versionId: '30000000-0000-4000-8000-000000000001',
      version: spec.version,
      specification: spec,
    },
  };
  assert.equal(StaffReportSchema.safeParse({ ...report, context }).success, true);
  for (const snapshot of [
    { ...context.snapshot, version: '9.0.0' },
    { ...context.snapshot, slug: 'wrong-resource' },
    { ...context.snapshot, editorial: { private: 'forbidden' } },
    { ...context.snapshot, specification: { ...spec, ownerId: id } },
  ])
    assert.equal(
      StaffReportSchema.safeParse({ ...report, context: { ...context, snapshot } }).success,
      false,
    );
  assert.equal(
    StaffReportSchema.safeParse({
      ...report,
      targetKind: 'profile',
      context: {
        capturedAt: date,
        snapshot: {
          kind: 'profile',
          username: 'synthetic',
          displayName: '<script>plain text</script>',
          bio: 'Untrusted profile text.',
          website: 'https://example.test',
        },
      },
    }).success,
    true,
  );
});
test('report resolutions confirm exact results and map duplicate closures without exposing provider errors', async () => {
  const { data, state, calls } = fixture();
  assert.deepEqual(await data.decideReport(input), resolved);
  assert.deepEqual(calls[0], {
    name: 'agentgrid_decide_report',
    body: { report_resource_id: id, decision: 'resolved', explanation: input.explanation },
  });
  for (const bad of [
    null,
    report,
    { ...resolved, id: targetId },
    { ...resolved, state: 'dismissed' },
    { ...resolved, resolution: 'Different staff resolution must be rejected.' },
  ]) {
    state.resolved = bad;
    await assert.rejects(data.decideReport(input), fails(503));
  }
  await assert.rejects(data.decideReport({ ...input, staffId: id }), fails(400));
  state.error = { code: '40001', message: 'PRIVATE conflict context' };
  await assert.rejects(data.decideReport(input), fails(409));
});
test('staff report HTTP denies forged authority, duplicate filters and CSRF-free resolution', async () => {
  const identity = await identityFixture(),
    calls = [];
  const handle = moderationHandler(identity.runtime, () => ({
    reportQueue: async (state, offset) => {
      calls.push(['queue', state, offset]);
      return { state, offset, reports: [], hasMore: false };
    },
    staffReport: async (id) => {
      calls.push(['report', id]);
      return report;
    },
    decideReport: async (body) => {
      calls.push(['resolve', body]);
      return resolved;
    },
  }));
  const request = (path, body, csrf, extra = {}) =>
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
  assert.equal((await handle(request('/api/moderation/reports/?state=open'))).status, 401);
  await identity.request('/api/identity/');
  await identity.request('/api/identity/email/', { email: 'owner@example.test' });
  const verified = await identity.request('/api/identity/verify/', { code: '12345678' }),
    csrf = verified.data.csrf;
  for (const query of [
    'state=open&state=resolved',
    'state=pending',
    'state=open&offset=10000',
    'state=open&reporterId=' + id,
  ])
    assert.equal((await handle(request('/api/moderation/reports/?' + query))).status, 400);
  assert.equal((await handle(request('/api/moderation/resolution/', input))).status, 403);
  assert.equal(
    (await handle(request('/api/moderation/resolution/', { ...input, reporterId: id }, csrf)))
      .status,
    400,
  );
  assert.equal(
    (await handle(request('/api/moderation/report/?reportId=' + id + '&reportId=' + id))).status,
    400,
  );
  assert.equal(
    (
      await handle(
        request('/api/moderation/report/?reportId=' + id, undefined, undefined, {
          'sec-fetch-site': 'cross-site',
        }),
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
  assert.equal((await handle(request('/api/moderation/report/?reportId=' + id))).status, 200);
  assert.equal((await handle(request('/api/moderation/resolution/', input, csrf))).status, 200);
  assert.deepEqual(calls, [
    ['report', id],
    ['resolve', input],
  ]);
});
