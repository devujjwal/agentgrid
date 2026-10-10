import test from 'node:test';
import assert from 'node:assert/strict';
import { verifiedRenderCost } from '../backend/billing/reconcile.ts';
import { sha256 } from '../backend/integrations/http.ts';
import worker from '../backend/execution/worker.ts';

const taskId = '55555555-5555-4555-8555-555555555555';
const evidence = new TextEncoder().encode(
  'SYNTHETIC task-specific debit fixture; not a real invoice',
);
const hash = await sha256(evidence);
const receipt = {
  version: 1,
  provider: 'shotstack-production',
  taskId,
  providerOwner: 'fixture-owner',
  currency: 'USD',
  credits: 1.2345,
  actualDebitMicros: 125000,
  evidenceSha256: hash,
  reviewedBy: '11111111-1111-4111-8111-111111111111',
  reviewedAt: '2026-10-10T12:00:00Z',
  basis: 'task-specific-provider-debit',
  settled: true,
};
function setup(overrides = {}) {
  const calls = [];
  const options = {
    enabled: () => true,
    providerOwner: 'fixture-owner',
    apiKey: 'fixture-key',
    now: () => new Date('2026-10-10T13:00:00Z'),
    bucket: {
      async get(key) {
        calls.push(key);
        const data = key.startsWith('receipts/')
          ? new TextEncoder().encode(JSON.stringify(receipt))
          : evidence;
        return { size: data.length, body: new Response(data).body };
      },
    },
    async transport(url, init) {
      calls.push({ url, ...init });
      return Response.json({
        success: true,
        response: { id: taskId, owner: 'fixture-owner', status: 'done', credits: 1.2345 },
      });
    },
    ...overrides,
  };
  return { calls, options };
}
test('disabled reconciliation performs no provider or storage operations', async () => {
  const { calls, options } = setup({ enabled: () => false });
  assert.equal(await verifiedRenderCost(taskId, options), null);
  assert.deepEqual(calls, []);
});
test('verified fixture returns exact attested USD debit after independent usage readback', async () => {
  const { calls, options } = setup();
  assert.equal(await verifiedRenderCost(taskId, options), 125000);
  assert.equal(calls[2].method, 'GET');
  assert.equal(calls[2].url, `https://api.shotstack.io/edit/v1/render/${taskId}`);
  assert.equal(calls[2].redirect, 'manual');
});
test('absent or corrupted private evidence never reaches provider', async () => {
  for (const bucket of [
    undefined,
    { get: async () => null },
    {
      get: async (key) => {
        const data = key.startsWith('receipts/') ? JSON.stringify(receipt) : 'corrupt';
        return { size: data.length, body: new Response(data).body };
      },
    },
  ]) {
    const { calls, options } = setup({ bucket });
    assert.equal(await verifiedRenderCost(taskId, options), null);
    assert.deepEqual(calls, []);
  }
});
test('receipt refuses estimates, non-USD, wrong task/account, future review and unsafe amounts', async () => {
  for (const patch of [
    { basis: 'estimate' },
    { currency: 'INR' },
    { taskId: receipt.reviewedBy },
    { providerOwner: 'other-owner' },
    { reviewedAt: '2026-10-11T12:00:00Z' },
    { actualDebitMicros: -1 },
    { actualDebitMicros: 1.1 },
    { settled: false },
  ]) {
    const { calls, options } = setup({
      bucket: {
        get: async () => {
          const data = JSON.stringify({ ...receipt, ...patch });
          return { size: data.length, body: new Response(data).body };
        },
      },
    });
    assert.equal(await verifiedRenderCost(taskId, options), null);
    assert.deepEqual(calls, []);
  }
});
test('missing credits, changed usage, owner/task mismatch and unfinished status retain reservation', async () => {
  for (const patch of [
    { credits: undefined },
    { credits: 1.3 },
    { owner: 'other-owner' },
    { id: receipt.reviewedBy },
    { status: 'queued' },
  ]) {
    const { options } = setup({
      transport: async () =>
        Response.json({
          success: true,
          response: {
            id: taskId,
            owner: 'fixture-owner',
            status: 'done',
            credits: 1.2345,
            ...patch,
          },
        }),
    });
    assert.equal(await verifiedRenderCost(taskId, options), null);
  }
});
test('redirects and provider failure cannot supply settlement evidence', async () => {
  for (const transport of [
    async () =>
      new Response(null, { status: 302, headers: { Location: 'https://untrusted.example' } }),
    async () => {
      throw Error('offline');
    },
  ]) {
    const { options } = setup({ transport });
    assert.equal(await verifiedRenderCost(taskId, options), null);
  }
});
test('invalid task input cannot reach any external resource', async () => {
  const { calls, options } = setup();
  assert.equal(await verifiedRenderCost('../secret', options), null);
  assert.deepEqual(calls, []);
});
test('disabled queue and cron cannot read credentials, database, billing or dispatch', async () => {
  let acknowledged = 0;
  const env = new Proxy(
    { AGENTGRID_EXECUTION_ENABLED: '0' },
    {
      get(target, key) {
        if (key !== 'AGENTGRID_EXECUTION_ENABLED') throw Error('unexpected environment access');
        return target[key];
      },
    },
  );
  await worker.queue(
    {
      messages: [
        {
          body: { kind: 'render' },
          ack() {
            acknowledged++;
          },
          retry() {
            throw Error('unexpected retry');
          },
        },
      ],
    },
    env,
  );
  assert.equal(acknowledged, 1);
  await worker.scheduled({}, env);
});
