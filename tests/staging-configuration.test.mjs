import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configureStaging,
  stagingProjectPlan,
  inspectStagingProject,
  stagingAccount,
} from '../scripts/configure-staging.mjs';
const token = 'synthetic-token-not-a-real-credential';
test('empty staging setup is additive, fail-closed and creates no paid binding or secret', async () => {
  const plan = stagingProjectPlan();
  let exists = false;
  const calls = [];
  const transport = async (input, init) => {
    calls.push({ input, init });
    assert.equal(init.redirect, 'error');
    assert.ok(
      String(input).startsWith(
        `https://api.cloudflare.com/client/v4/accounts/${stagingAccount}/pages/projects`,
      ),
    );
    if (init.method === 'POST') {
      exists = true;
      assert.deepEqual(JSON.parse(init.body), plan);
      return Response.json({ success: true, result: plan });
    }
    return exists
      ? Response.json({ success: true, result: plan })
      : new Response(null, { status: 404 });
  };
  assert.equal((await configureStaging(token, false, transport)).state, 'not-created');
  assert.equal(calls.length, 1);
  assert.equal((await configureStaging(token, true, transport)).state, 'created-and-verified');
  assert.equal((await configureStaging(token, true, transport)).state, 'verified-existing');
  assert.equal(calls.filter((x) => x.init.method === 'POST').length, 1);
  assert.equal(JSON.stringify(plan).includes('secret_text'), false);
  for (const config of Object.values(plan.deployment_configs))
    assert.equal(config.fail_open, false);
});
test('existing unsafe or unrelated projects are never patched and uncertain creates are not retried', async () => {
  for (const mutate of [
    (p) => {
      p.name = 'other';
    },
    (p) => {
      p.source = { type: 'github' };
    },
    (p) => {
      p.domains = ['other.test'];
    },
    (p) => {
      p.deployment_configs.production.fail_open = true;
    },
    (p) => {
      p.deployment_configs.preview.r2_buckets = { assets: { name: 'other' } };
    },
  ]) {
    const project = stagingProjectPlan();
    mutate(project);
    assert.throws(() => inspectStagingProject(project));
    let calls = 0;
    await assert.rejects(
      configureStaging(token, true, async (_, init) => {
        calls++;
        assert.equal(init.method, 'GET');
        return Response.json({ success: true, result: project });
      }),
    );
    assert.equal(calls, 1);
  }
  let posts = 0;
  await assert.rejects(
    configureStaging(token, true, async (_, init) => {
      if (init.method === 'GET') return new Response(null, { status: 404 });
      posts++;
      throw new Error('Acknowledgement lost');
    }),
  );
  assert.equal(posts, 1);
});
