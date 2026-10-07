import test from 'node:test';
import assert from 'node:assert/strict';
import { deploymentPlan, verifyInfrastructureDelivery } from '../scripts/deploy-infrastructure.mjs';

const head = 'a'.repeat(40);
const allowed = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'devujjwal/agentgrid',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_SHA: head,
  RELEASE_COMMIT: head,
  CLOUDFLARE_ACCOUNT_ID: 'b26860f18457e76742260d8bb979134f',
  CLOUDFLARE_API_TOKEN: 'fixture-only',
};

test('release gate binds manual main CI to exact commit and approved infrastructure destination', () => {
  const plan = deploymentPlan(allowed, head, true);
  assert.ok(plan.includes('agentgrid-infrastructure'));
  assert.equal(plan[plan.indexOf('--branch') + 1], 'main');
  for (const delta of [
    { GITHUB_ACTIONS: 'false' },
    { GITHUB_REPOSITORY: 'work/agentgrid' },
    { GITHUB_REF: 'refs/heads/feature' },
    { GITHUB_EVENT_NAME: 'pull_request' },
    { GITHUB_SHA: 'b'.repeat(40) },
    { RELEASE_COMMIT: head + '; curl attacker' },
    { CLOUDFLARE_ACCOUNT_ID: 'other-account' },
    { CLOUDFLARE_API_TOKEN: '' },
  ])
    assert.throws(() => deploymentPlan({ ...allowed, ...delta }, head, true));
  assert.throws(() => deploymentPlan(allowed, head, false));
});

test('deployment health gate checks public content, headers, crawler exclusion and true 404', async () => {
  const headers = {
    'content-security-policy': "default-src 'self'",
    'x-content-type-options': 'nosniff',
    'x-robots-tag': 'noindex, nofollow',
  };
  const fixture =
    (override = {}) =>
    async (url) => {
      assert.equal(new URL(url).origin, 'https://agentgrid-infrastructure.pages.dev');
      const path = new URL(url).pathname;
      if (path === '/')
        return new Response('AgentGrid infrastructure verification', { headers, ...override });
      if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /\n');
      return new Response('Not found', { status: 404 });
    };
  await verifyInfrastructureDelivery(fixture());
  await assert.rejects(verifyInfrastructureDelivery(fixture({ headers: {} })));
  await assert.rejects(verifyInfrastructureDelivery(fixture({ status: 500 })));
  await assert.rejects(
    verifyInfrastructureDelivery(
      async () => new Response('AgentGrid infrastructure verification', { headers }),
    ),
  );
});
