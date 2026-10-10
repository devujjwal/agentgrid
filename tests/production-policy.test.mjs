import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { hardenDocument, documentHeaderPolicy } from '../scripts/static-csp.mjs';
import { readPublication } from '../scripts/verify-publication.mjs';
import {
  assertProductionInventory,
  productionDeploymentPlan,
  productionProjectPlan,
  inspectProductionProject,
  productionAccount,
  productionProject,
  productionOrigin,
  productionAlias,
  productionRobots,
  verifyProductionDelivery,
} from '../scripts/production-policy.mjs';

test('the reviewed catalogue passes while an undersized fixture and changed guides fail', async () => {
  const publication = await readPublication('content/publication');
  const editorial = JSON.parse(await readFile('content/launch/reviewed-editorial.json', 'utf8'));
  assert.doesNotThrow(() => assertProductionInventory(publication, editorial));
  const undersized = structuredClone(publication);
  undersized.catalogue.resources = undersized.catalogue.resources.slice(0, 35);
  const retainedVersions = new Set(undersized.catalogue.resources.map((row) => row.version_id));
  const undersizedEditorial = editorial.filter((row) => retainedVersions.has(row.version_id));
  assert.throws(
    () => assertProductionInventory(undersized, undersizedEditorial),
    /requires at least 36/,
  );
  assert.throws(() => assertProductionInventory(publication, []), /bundle is required/);
  const changed = structuredClone(editorial);
  changed[0].editorial.overview += ' Unreviewed changed text.';
  assert.throws(() => assertProductionInventory(publication, changed), /does not match/);
});

test('production upload requires exact clean manually dispatched main and the personal account', () => {
  const head = 'a'.repeat(40);
  const env = {
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: 'devujjwal/agentgrid',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_SHA: head,
    RELEASE_COMMIT: head,
    CLOUDFLARE_ACCOUNT_ID: productionAccount,
    CLOUDFLARE_API_TOKEN: 'synthetic',
  };
  const args = productionDeploymentPlan(env, head, true);
  assert.equal(args[args.indexOf('--project-name') + 1], productionProject);
  for (const change of [
    { GITHUB_REF: 'refs/heads/codex/change' },
    { GITHUB_EVENT_NAME: 'push' },
    { RELEASE_COMMIT: 'b'.repeat(40) },
    { CLOUDFLARE_ACCOUNT_ID: 'work-account' },
    { CLOUDFLARE_API_TOKEN: '' },
  ])
    assert.throws(() => productionDeploymentPlan({ ...env, ...change }, head, true));
  assert.throws(() => productionDeploymentPlan(env, head, false));
});

test('production policy isolates secrets from preview and refuses inherited pilot/publisher settings', () => {
  const project = {
    ...productionProjectPlan(),
    subdomain: `${productionProject}.pages.dev`,
    domains: [`${productionProject}.pages.dev`],
  };
  assert.equal(inspectProductionProject(project), true);
  assert.throws(
    () => inspectProductionProject(project, { requireBindings: true }),
    /not provisioned/,
  );
  for (const mutate of [
    (p) => {
      p.deployment_configs.preview.env_vars.SUPABASE_SECRET_KEY = { type: 'secret_text' };
    },
    (p) => {
      p.deployment_configs.production.env_vars.AGENTGRID_PILOT_EMAILS = { type: 'secret_text' };
    },
    (p) => {
      p.deployment_configs.production.env_vars.AGENTGRID_PUBLICATION_ENABLED.value = '1';
    },
    (p) => {
      p.domains.push('work.example');
    },
    (p) => {
      p.deployment_configs.production.fail_open = true;
    },
    (p) => {
      p.deployment_configs.production.services = { unapproved: {} };
    },
  ]) {
    const modified = structuredClone(project);
    mutate(modified);
    assert.throws(() => inspectProductionProject(modified));
  }
});

function deliveryFixture(origin, mutate = () => {}) {
  const proof = {
    contract_version: '0.1',
    commit: 'a'.repeat(40),
    catalogue_sha256: 'b'.repeat(64),
    source_revision: 9,
  };
  const html = hardenDocument(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>AgentGrid</title><meta name="robots" content="index,follow"></head><body><h1>AgentGrid</h1></body></html>',
  );
  const responses = new Map([
    [
      '/',
      new Response(html, {
        headers: {
          'content-security-policy': documentHeaderPolicy,
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'DENY',
        },
      }),
    ],
    ['/agentgrid-release.json', Response.json(proof)],
    ['/robots.txt', new Response(productionRobots)],
    [
      '/api/identity/',
      origin === productionAlias
        ? new Response('', { status: 400 })
        : Response.json(
            { signedIn: false, csrf: 'c'.repeat(43) },
            {
              headers: {
                'cache-control': 'private, no-store',
                'set-cookie':
                  '__Host-agentgrid_csrf=opaque; Secure; Path=/; HttpOnly; SameSite=Lax',
              },
            },
          ),
    ],
  ]);
  mutate(responses, proof, html);
  return {
    proof,
    transport: async (url, options) => {
      assert.equal(new URL(url).origin, origin);
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      return responses.get(new URL(url).pathname)?.clone() ?? new Response('', { status: 404 });
    },
  };
}
test('production delivery verifies build identity, crawl/security policy, private paths and canonical session isolation', async () => {
  for (const origin of [productionOrigin, productionAlias]) {
    const f = deliveryFixture(origin);
    await verifyProductionDelivery(f.proof, origin, f.transport);
  }
  for (const mutate of [
    (r) => r.get('/').headers.set('x-robots-tag', 'noindex'),
    (r) => r.get('/').headers.delete('content-security-policy'),
    (r) => r.set('/robots.txt', new Response('User-agent: *\nDisallow: /')),
    (r, p) => r.set('/agentgrid-release.json', Response.json({ ...p, commit: 'd'.repeat(40) })),
    (r) => r.set('/.env', new Response('unexpected artifact')),
    (r) => r.get('/api/identity/').headers.set('cache-control', 'public, max-age=60'),
  ]) {
    const f = deliveryFixture(productionOrigin, mutate);
    await assert.rejects(verifyProductionDelivery(f.proof, productionOrigin, f.transport));
  }
  const alias = deliveryFixture(productionAlias, (r) =>
    r.get('/api/identity/').headers.set('set-cookie', '__Host-agentgrid_csrf=unexpected'),
  );
  await assert.rejects(
    verifyProductionDelivery(alias.proof, productionAlias, alias.transport),
    /alias must reject/,
  );
});
