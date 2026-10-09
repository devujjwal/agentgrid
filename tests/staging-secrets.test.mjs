import test from 'node:test';
import assert from 'node:assert/strict';
import {
  configureStagingSecrets,
  stagingBackendName,
  stagingBackendDescription,
} from '../scripts/configure-staging-secrets.mjs';
import { stagingProjectPlan } from '../scripts/configure-staging.mjs';
const values = {
  CLOUDFLARE_API_TOKEN: 'synthetic-cloudflare-credential',
  SUPABASE_ACCESS_TOKEN: 'sbp_' + 'a'.repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: 'https://lxecbrvzpmgjmsqiachc.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_' + 'b'.repeat(32),
  RESEND_API_KEY: 're_' + 'c'.repeat(32),
  RESEND_FROM_EMAIL: 'access@mail.agentgrid.me',
};
function fixture() {
  const project = stagingProjectPlan(),
    calls = [];
  const protectedKey = { id: 'default', name: 'default', type: 'secret', hash: 'untouched' };
  const keys = [protectedKey];
  let failPatch = false;
  const transport = async (url, init) => {
    calls.push({ url, init });
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal instanceof AbortSignal);
    if (url.startsWith('https://api.cloudflare.com/')) {
      if (init.method === 'PATCH') {
        const body = JSON.parse(init.body);
        assert.deepEqual(Object.keys(body.deployment_configs), ['production']);
        Object.assign(
          project.deployment_configs.production.env_vars,
          body.deployment_configs.production.env_vars,
        );
        for (const binding of Object.values(project.deployment_configs.production.env_vars))
          if (binding.type === 'secret_text') delete binding.value;
        if (failPatch) throw new Error('raw-secret-diagnostic');
      }
      return Response.json({ success: true, result: project });
    }
    if (init.method === 'POST') {
      assert.deepEqual(JSON.parse(init.body), {
        type: 'secret',
        name: stagingBackendName,
        description: stagingBackendDescription,
        secret_jwt_template: { role: 'service_role' },
      });
      const key = {
        id: '11111111-1111-4111-8111-111111111111',
        type: 'secret',
        name: stagingBackendName,
        description: stagingBackendDescription,
        secret_jwt_template: { role: 'service_role' },
      };
      keys.push(key);
      return Response.json({ ...key, api_key: 'sb_secret_' + 's'.repeat(32) }, { status: 201 });
    }
    if (url.endsWith('?reveal=true'))
      return Response.json({ ...keys[1], api_key: 'sb_secret_' + 's'.repeat(32) });
    assert.ok(url.endsWith('?reveal=false'));
    return Response.json(keys);
  };
  return {
    project,
    keys,
    calls,
    transport,
    failPatch: () => {
      failPatch = true;
    },
  };
}
test('staging bootstrap is dry by default and stores secrets only in main encrypted bindings', async () => {
  const f = fixture();
  const preview = structuredClone(f.project.deployment_configs.preview);
  const plan = await configureStagingSecrets(values, undefined, f.transport);
  assert.equal(plan.createKey, true);
  assert.equal(plan.missing.length, 8);
  assert.ok(f.calls.every((c) => c.init.method === 'GET'));
  const result = await configureStagingSecrets(values, true, f.transport);
  assert.equal(result.state, 'configured-and-verified');
  assert.ok(!JSON.stringify(result).includes('sb_secret_'));
  assert.deepEqual(f.project.deployment_configs.preview, preview);
  assert.equal(f.keys[0].hash, 'untouched');
  const patch = JSON.parse(f.calls.find((c) => c.init.method === 'PATCH').init.body)
    .deployment_configs.production.env_vars;
  for (const name of [
    'SUPABASE_SECRET_KEY',
    'RESEND_API_KEY',
    'AGENTGRID_ENVELOPE_KEYS',
    'AGENTGRID_RATE_KEY',
    'AGENTGRID_PILOT_EMAILS',
  ])
    assert.equal(patch[name].type, 'secret_text');
  assert.equal(JSON.parse(patch.AGENTGRID_ENVELOPE_KEYS.value)[0].material.length, 43);
  assert.equal(patch.AGENTGRID_RATE_KEY.value.length, 43);
  const before = f.calls.length;
  assert.equal(
    (await configureStagingSecrets(values, true, f.transport)).state,
    'verified-existing',
  );
  assert.ok(f.calls.slice(before).every((c) => c.init.method === 'GET'));
});
test('lost acknowledgement is recovered by readback without replacement, re-creation or secret logging', async () => {
  const f = fixture();
  f.failPatch();
  await assert.rejects(
    configureStagingSecrets(values, true, f.transport),
    (error) => !error.message.includes('raw-secret') && /uncertain/.test(error.message),
  );
  assert.equal(
    (await configureStagingSecrets(values, true, f.transport)).state,
    'verified-existing',
  );
  assert.equal(f.calls.filter((c) => c.init.method === 'POST').length, 1);
  assert.equal(f.calls.filter((c) => c.init.method === 'PATCH').length, 1);
});
test('partial bootstrap recovers its named key and refuses conflicting, deployed or unrelated environments', async () => {
  const f = fixture();
  f.keys.push({
    id: '11111111-1111-4111-8111-111111111111',
    type: 'secret',
    name: stagingBackendName,
    description: stagingBackendDescription,
    secret_jwt_template: { role: 'service_role' },
  });
  f.project.deployment_configs.production.env_vars.AGENTGRID_RATE_KEY = { type: 'secret_text' };
  await configureStagingSecrets(values, true, f.transport);
  assert.equal(f.calls.filter((c) => c.init.method === 'POST').length, 0);
  const patch = JSON.parse(f.calls.find((c) => c.init.method === 'PATCH').init.body)
    .deployment_configs.production.env_vars;
  assert.equal(patch.AGENTGRID_RATE_KEY, undefined);
  for (const mutate of [
    (f) => {
      f.project.canonical_deployment = { id: 'deployed' };
    },
    (f) => {
      f.project.deployment_configs.preview.env_vars.SUPABASE_SECRET_KEY = { type: 'secret_text' };
    },
    (f) => {
      f.project.deployment_configs.production.env_vars.SUPABASE_SECRET_KEY = {
        type: 'plain_text',
        value: 'unsafe',
      };
    },
    (f) => {
      f.keys.push({ name: stagingBackendName, type: 'secret', description: 'different purpose' });
    },
    (f) => {
      f.project.deployment_configs.production.env_vars.RESEND_FROM_EMAIL = {
        type: 'plain_text',
        value: 'other@mail.agentgrid.me',
      };
    },
  ]) {
    const f = fixture();
    mutate(f);
    await assert.rejects(configureStagingSecrets(values, true, f.transport));
    assert.ok(f.calls.every((c) => c.init.method === 'GET'));
  }
  await assert.rejects(configureStagingSecrets({ ...values, CI: 'true' }, true, f.transport));
  await assert.rejects(
    configureStagingSecrets(
      { ...values, NEXT_PUBLIC_SUPABASE_URL: 'https://other.supabase.co' },
      true,
      f.transport,
    ),
  );
});
