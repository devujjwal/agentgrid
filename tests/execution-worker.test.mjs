import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/execution/worker.ts';
import { runtimeModel, runtimeProviderIdentity } from '../backend/execution/openai.ts';
const subject = crypto.randomUUID(),
  id = crypto.randomUUID();
const env = {
  AGENTGRID_EXECUTION_ENABLED: '1',
  AGENTGRID_STAGE: 'production',
  AGENTGRID_ORIGIN: 'https://agentgrid.me',
  NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'p'.repeat(24),
  SUPABASE_SECRET_KEY: 'sb_secret_' + 's'.repeat(24),
  OPENAI_API_KEY: 'test-only-secret',
};
test('queue consumer acknowledges successful generation and never redispatches a duplicate message', async () => {
  const original = globalThis.fetch;
  let providerCalls = 0,
    acks = 0,
    retries = 0;
  const record = {
    id,
    ownerId: crypto.randomUUID(),
    versionId: crypto.randomUUID(),
    idempotencyKey: crypto.randomUUID(),
    providerIdentity: runtimeProviderIdentity,
    instructions: 'Synthetic instructions',
    input: 'Synthetic input',
    digest: 'a'.repeat(64),
    maximumCostMicros: 5000,
    approved: true,
    state: 'queued',
    output: null,
  };
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://api.openai.com/v1/responses') {
      providerCalls++;
      return Response.json({
        model: runtimeModel,
        status: 'completed',
        usage: { input_tokens: 10, output_tokens: 10 },
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Synthetic output' }] }],
      });
    }
    assert.equal(
      String(url),
      'https://synthetic.supabase.co/rest/v1/rpc/agentgrid_server_execution',
    );
    const body = JSON.parse(init.body);
    assert.equal(body.actor_user_id, subject);
    if (body.operation === 'read') return Response.json(record);
    if (body.operation === 'claim') {
      if (record.state !== 'queued') return Response.json(false);
      record.state = 'running';
      return Response.json(true);
    }
    if (body.operation === 'finish') {
      record.state = body.evidence.state;
      record.output = body.evidence.output;
      assert.equal(body.evidence.billedMicros, 20);
      return Response.json(null);
    }
    throw new Error('Unexpected operation');
  };
  const message = {
    body: { subject, runId: id, digest: record.digest },
    ack() {
      acks++;
    },
    retry() {
      retries++;
    },
  };
  try {
    await worker.queue({ messages: [message, message] }, env);
    assert.equal(providerCalls, 1);
    assert.equal(acks, 2);
    assert.equal(retries, 0);
    assert.equal(record.output, 'Synthetic output');
  } finally {
    globalThis.fetch = original;
  }
});
test('disabled execution and malformed jobs perform no database or provider calls', async () => {
  const original = globalThis.fetch;
  let calls = 0,
    acks = 0;
  globalThis.fetch = async () => {
    calls++;
    throw new Error('Must not call');
  };
  try {
    const message = {
      body: { subject, runId: id, digest: 'a'.repeat(64) },
      ack() {
        acks++;
      },
      retry() {
        throw new Error('Must not retry');
      },
    };
    await worker.queue({ messages: [message] }, { ...env, AGENTGRID_EXECUTION_ENABLED: '0' });
    await worker.queue(
      { messages: [{ ...message, body: { ...message.body, ownerId: subject } }] },
      env,
    );
    assert.equal(calls, 0);
    assert.equal(acks, 2);
  } finally {
    globalThis.fetch = original;
  }
});
