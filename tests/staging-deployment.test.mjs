import test from 'node:test';
import assert from 'node:assert/strict';
import {
  stagingDeploymentPlan,
  verifyStagingDelivery,
  verifyStagingReadiness,
  assertStagingBindings,
  stagingOrigin,
} from '../scripts/deploy-staging.mjs';
import { stagingProjectPlan, stagingAccount } from '../scripts/configure-staging.mjs';
import { hardenDocument, documentHeaderPolicy } from '../scripts/static-csp.mjs';
const head = 'a'.repeat(40);
const env = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'devujjwal/agentgrid',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_SHA: head,
  RELEASE_COMMIT: head,
  CLOUDFLARE_ACCOUNT_ID: stagingAccount,
  CLOUDFLARE_API_TOKEN: 'synthetic-only',
};
test('staging propagation retries only bounded verification reads and still refuses persistent failure', async () => {
  let reads = 0;
  const pauses = [];
  await verifyStagingReadiness(
    { commit: head },
    async (proof) => {
      assert.equal(proof.commit, head);
      if (++reads < 3) throw new Error('propagating');
    },
    async (ms) => {
      pauses.push(ms);
    },
  );
  assert.equal(reads, 3);
  assert.deepEqual(pauses, [2000, 2000]);
  reads = 0;
  await assert.rejects(
    verifyStagingReadiness(
      {},
      async () => {
        reads++;
        throw new Error('private-diagnostic');
      },
      async () => {},
    ),
    /did not settle/,
  );
  assert.equal(reads, 4);
});
test('staging deploy is exact-main and cannot target a production domain, work repository or dirty tree', () => {
  const args = stagingDeploymentPlan(env, head, true);
  assert.equal(args[args.indexOf('--project-name') + 1], 'agentgrid-staging');
  assert.ok(args.includes('--no-bundle'));
  for (const change of [
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_REPOSITORY: 'work/agentgrid' },
    { GITHUB_REF: 'refs/heads/codex/change' },
    { GITHUB_EVENT_NAME: 'push' },
    { GITHUB_SHA: 'b'.repeat(40) },
    { RELEASE_COMMIT: 'other' },
    { CLOUDFLARE_ACCOUNT_ID: 'other' },
    { CLOUDFLARE_API_TOKEN: '' },
  ])
    assert.throws(() => stagingDeploymentPlan({ ...env, ...change }, head, true));
  assert.throws(() => stagingDeploymentPlan(env, head, false));
  const project = stagingProjectPlan();
  assert.throws(() => assertStagingBindings(project));
  const bindings = project.deployment_configs.production.env_vars;
  for (const key of [
    'SUPABASE_SECRET_KEY',
    'RESEND_API_KEY',
    'AGENTGRID_ENVELOPE_KEYS',
    'AGENTGRID_RATE_KEY',
    'AGENTGRID_PILOT_EMAILS',
  ])
    bindings[key] = { type: 'secret_text', value: 'masked' };
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'RESEND_FROM_EMAIL',
  ])
    bindings[key] = { type: 'plain_text', value: 'synthetic' };
  assertStagingBindings(project);
  bindings.SUPABASE_SECRET_KEY.type = 'plain_text';
  assert.throws(() => assertStagingBindings(project));
});
test('staging receipt is verified against live headers, build identity, anonymous auth and private-route denial', async () => {
  const proof = {
    contract_version: '0.1',
    commit: head,
    catalogue_sha256: 'b'.repeat(64),
    source_revision: 0,
  };
  const source = (changed) => async (url) => {
    assert.equal(new URL(url).origin, stagingOrigin);
    const path = new URL(url).pathname;
    if (path === changed) return new Response('wrong content', { status: 200 });
    if (path === '/' || path === '/sign-in/')
      return new Response(
        hardenDocument(
          '<!doctype html><html><head><meta charset="utf-8"></head><body>AgentGrid</body></html>',
        ),
        {
          headers: {
            'content-security-policy': documentHeaderPolicy,
            'x-frame-options': 'DENY',
            'x-content-type-options': 'nosniff',
            'x-robots-tag': 'noindex, nofollow',
          },
        },
      );
    if (path === '/agentgrid-release.json') return Response.json(proof);
    if (path === '/api/identity/')
      return Response.json(
        { signedIn: false, csrf: 'c'.repeat(43) },
        {
          headers: {
            'cache-control': 'private, no-store',
            'set-cookie': '__Host-agentgrid_csrf=synthetic; Secure; HttpOnly; Path=/',
          },
        },
      );
    if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /');
    return new Response(null, { status: 404 });
  };
  await verifyStagingDelivery(proof, source());
  for (const path of [
    '/',
    '/agentgrid-release.json',
    '/api/identity/',
    '/_worker.js',
    '/qa/release-review/',
    '/robots.txt',
  ])
    await assert.rejects(verifyStagingDelivery(proof, source(path)));
});
