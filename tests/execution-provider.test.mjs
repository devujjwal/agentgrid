import test from 'node:test';
import assert from 'node:assert/strict';
import { openaiTextProvider, runtimeModel, estimateTextCost } from '../backend/execution/openai.ts';
import { executionStore } from '../backend/execution/store.ts';
const request = {
  instructions: 'Synthetic instructions',
  input: 'Synthetic input',
  maxOutputTokens: 2048,
  idempotencyKey: crypto.randomUUID(),
  signal: AbortSignal.timeout(1000),
};
const output = {
  model: runtimeModel,
  status: 'completed',
  usage: { input_tokens: 100, output_tokens: 100 },
  output: [{ type: 'message', content: [{ type: 'output_text', text: 'Synthetic result' }] }],
};
test('Responses adapter uses a fixed model, disables tools/storage and settles bounded usage', async () => {
  let calls = 0;
  const provider = openaiTextProvider('test-only-secret', async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.openai.com/v1/responses');
    assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.equal(body.model, runtimeModel);
    assert.equal(body.store, false);
    assert.deepEqual(body.tools, []);
    assert.equal(body.tool_choice, 'none');
    assert.equal(body.max_output_tokens, 2048);
    assert.equal(body.input, request.input);
    return Response.json(output);
  });
  assert.deepEqual(await provider.generate(request), {
    text: 'Synthetic result',
    billedMicros: 200,
  });
  assert.equal(calls, 1);
  assert.ok(estimateTextCost(request.instructions, request.input) >= 200);
});
test('redirects, incomplete output, unexpected tools and excess usage cannot become successful runs', async () => {
  for (const response of [
    new Response('', { status: 302, headers: { location: 'https://untrusted.example' } }),
    Response.json({ ...output, status: 'incomplete' }),
    Response.json({ ...output, usage: { input_tokens: 1000000, output_tokens: 100 } }),
    Response.json({ ...output, output: [{ type: 'function_call' }] }),
    new Response('x'.repeat(200001)),
  ]) {
    const provider = openaiTextProvider('test-only-secret', async () => response);
    await assert.rejects(provider.generate(request));
  }
});
test('persistent store pins verified subject, service RPC and bounded response without redirects', async () => {
  const subject = crypto.randomUUID();
  let called = 0;
  const env = {
    AGENTGRID_STAGE: 'production',
    AGENTGRID_ORIGIN: 'https://agentgrid.me',
    NEXT_PUBLIC_SUPABASE_URL: 'https://testproject.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'a'.repeat(30),
    SUPABASE_SECRET_KEY: 'sb_secret_' + 'b'.repeat(30),
  };
  const client = executionStore(env, subject, async (url, init) => {
    called++;
    assert.equal(url, 'https://testproject.supabase.co/rest/v1/rpc/agentgrid_server_execution');
    assert.equal(init.redirect, 'manual');
    const body = JSON.parse(init.body);
    assert.equal(body.actor_user_id, subject);
    assert.equal(body.operation, 'read');
    return Response.json(null);
  });
  assert.equal(await client.store.read(crypto.randomUUID(), crypto.randomUUID()), null);
  assert.equal(called, 1);
  const redirected = executionStore(
    env,
    subject,
    async () =>
      new Response('', { status: 307, headers: { location: 'https://untrusted.example' } }),
  );
  await assert.rejects(redirected.store.read('', crypto.randomUUID()));
});
