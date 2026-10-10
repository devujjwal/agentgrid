/** Production release boundaries. No provider calls or credentials in this module. */
import { inspectLaunchInventory } from '../backend/publication/quality.ts';
import { documentHeaderPolicy } from '../src/domain/document-security.ts';
import { verifyDocumentPolicy } from './static-csp.mjs';
import { EditorialSchema, PublicEditorialSchema } from '../src/domain/editorial.ts';
import { canonicalJson } from '../src/domain/content-checksum.ts';

export const productionAccount = 'b26860f18457e76742260d8bb979134f';
export const productionProject = 'agentgrid-production';
export const productionOrigin = 'https://agentgrid.me';
export const productionAlias = `https://${productionProject}.pages.dev`;

export function assertProductionInventory(publication, reviewedEditorial) {
  if (
    !Array.isArray(reviewedEditorial) ||
    reviewedEditorial.length !== publication.catalogue.resources.length
  )
    throw new Error('Exact immutable editorial review bundle is required.');
  const byVersion = new Map(reviewedEditorial.map((row) => [row.version_id, row.editorial]));
  if (byVersion.size !== reviewedEditorial.length)
    throw new Error('Duplicate editorial review identity.');
  const resources = publication.catalogue.resources.map((resource) => {
    const editorial = EditorialSchema.parse(byVersion.get(resource.version_id));
    const publicEditorial = Object.fromEntries(
      Object.entries(editorial).filter(([key]) => !['search_intent', 'review'].includes(key)),
    );
    if (
      canonicalJson(PublicEditorialSchema.parse(publicEditorial)) !==
      canonicalJson(resource.editorial)
    )
      throw new Error('Immutable editorial review does not match the released public guide.');
    return { specification: resource.specification, editorial };
  });
  const issues = inspectLaunchInventory(resources);
  if (issues.length) throw new Error('Production inventory gate failed: ' + issues.join(' '));
}

export function productionDeploymentPlan(environment, head, clean) {
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== 'devujjwal/agentgrid' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    !/^[a-f0-9]{40}$/.test(head) ||
    environment.GITHUB_SHA !== head ||
    environment.RELEASE_COMMIT !== head ||
    !clean ||
    environment.CLOUDFLARE_ACCOUNT_ID !== productionAccount ||
    !environment.CLOUDFLARE_API_TOKEN ||
    /[\r\n]/.test(environment.CLOUDFLARE_API_TOKEN)
  )
    throw new Error('Exact clean manual-main production release required.');
  return [
    'pages',
    'deploy',
    'site',
    '--project-name',
    productionProject,
    '--branch',
    'main',
    '--commit-hash',
    head,
    '--commit-dirty=false',
    '--no-bundle',
  ];
}

/** Production secrets never belong in preview deployments. Preview identity fails closed. */
export function productionProjectPlan() {
  const base = { compatibility_date: '2026-10-07', compatibility_flags: [], fail_open: false };
  return {
    name: productionProject,
    production_branch: 'main',
    deployment_configs: {
      production: {
        ...base,
        env_vars: {
          AGENTGRID_STAGE: { type: 'plain_text', value: 'production' },
          AGENTGRID_ORIGIN: { type: 'plain_text', value: productionOrigin },
          AGENTGRID_PUBLICATION_ENABLED: { type: 'plain_text', value: '0' },
          AGENTGRID_ANALYTICS_ENABLED: { type: 'plain_text', value: '0' },
        },
      },
      preview: { ...base, env_vars: {} },
    },
  };
}

export function inspectProductionProject(project, { requireBindings = false } = {}) {
  const domains = new Set(project.domains ?? []);
  if (
    project.name !== productionProject ||
    project.production_branch !== 'main' ||
    project.source ||
    project.subdomain !== `${productionProject}.pages.dev` ||
    !domains.has(`${productionProject}.pages.dev`) ||
    [...domains].some(
      (domain) => ![`${productionProject}.pages.dev`, 'agentgrid.me'].includes(domain),
    )
  )
    throw new Error('Unexpected production ownership, source or domains.');
  for (const stage of ['production', 'preview']) {
    const config = project.deployment_configs?.[stage];
    if (
      !config ||
      config.fail_open !== false ||
      config.compatibility_date !== '2026-10-07' ||
      (config.compatibility_flags ?? []).length
    )
      throw new Error('Production delivery policy changed.');
    for (const name of [
      'kv_namespaces',
      'd1_databases',
      'r2_buckets',
      'durable_object_namespaces',
      'services',
      'analytics_engine_datasets',
      'ai_bindings',
      'hyperdrive_bindings',
      'browsers',
    ])
      if (Object.keys(config[name] ?? {}).length) throw new Error('Unexpected service binding.');
    if (stage === 'preview' && Object.keys(config.env_vars ?? {}).length)
      throw new Error('Production preview must contain no application bindings.');
  }
  const bindings = project.deployment_configs.production.env_vars;
  const plain = (name, value) =>
    bindings[name]?.type === 'plain_text' && bindings[name]?.value === value;
  if (
    !plain('AGENTGRID_STAGE', 'production') ||
    !plain('AGENTGRID_ORIGIN', productionOrigin) ||
    !plain('AGENTGRID_PUBLICATION_ENABLED', '0') ||
    !plain('AGENTGRID_ANALYTICS_ENABLED', '0') ||
    bindings.AGENTGRID_PILOT_EMAILS
  )
    throw new Error('Production scope must not inherit staging admission or publishing flags.');
  if (requireBindings) {
    for (const name of [
      'SUPABASE_SECRET_KEY',
      'RESEND_API_KEY',
      'AGENTGRID_ENVELOPE_KEYS',
      'AGENTGRID_RATE_KEY',
    ])
      if (bindings[name]?.type !== 'secret_text')
        throw new Error('Production secrets are not provisioned.');
    for (const name of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
      'RESEND_FROM_EMAIL',
    ])
      if (bindings[name]?.type !== 'plain_text' || !bindings[name].value)
        throw new Error('Production public configuration is incomplete.');
    if (
      !plain('NEXT_PUBLIC_SUPABASE_URL', 'https://lxecbrvzpmgjmsqiachc.supabase.co') ||
      !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(
        bindings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.value,
      ) ||
      !/^[A-Za-z0-9._+-]+@mail\.agentgrid\.me$/.test(bindings.RESEND_FROM_EMAIL.value)
    )
      throw new Error('Production identity/email destination differs.');
  }
  return true;
}

export const productionRobots =
  'User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth/\nDisallow: /workspace/\nDisallow: /sign-in/\nDisallow: /saves/\nDisallow: /qa/\nSitemap: https://agentgrid.me/sitemap.xml\n';

// Recheck only public delivery after a confirmed upload. Each attempt enforces
// the complete policy; this never retries an upload or changes provider state.
export async function verifyProductionDeliveryWithRetry(
  expected,
  origin = productionOrigin,
  transport = fetch,
  pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
) {
  if (![productionOrigin, productionAlias].includes(origin))
    throw new Error('Unknown production destination.');
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      await verifyProductionDelivery(expected, origin, transport);
      return;
    } catch (error) {
      if (attempt === 5) throw error;
      await pause(10000);
    }
  }
}

export async function verifyProductionDelivery(
  expected,
  origin = productionOrigin,
  transport = fetch,
) {
  if (![productionOrigin, productionAlias].includes(origin))
    throw new Error('Unknown production destination.');
  const get = (path) =>
    transport(origin + path, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  const page = await get('/');
  if (
    page.status !== 200 ||
    page.headers.get('content-security-policy') !== documentHeaderPolicy ||
    page.headers.get('x-content-type-options') !== 'nosniff' ||
    page.headers.get('x-frame-options') !== 'DENY' ||
    /noindex/.test(page.headers.get('x-robots-tag') ?? '')
  )
    throw new Error('Production HTML/header delivery failed.');
  const html = await page.text();
  verifyDocumentPolicy(html);
  if (!html.includes('AgentGrid') || /<meta[^>]*name="robots"[^>]*content="[^"]*noindex/.test(html))
    throw new Error('Production discovery page is unavailable or excluded from indexing.');
  const proof = await get('/agentgrid-release.json');
  if (proof.status !== 200 || JSON.stringify(await proof.json()) !== JSON.stringify(expected))
    throw new Error('Production build identity differs.');
  const robots = await get('/robots.txt');
  if (robots.status !== 200 || (await robots.text()) !== productionRobots)
    throw new Error('Production crawler policy differs.');
  for (const path of [
    '/.env',
    '/_worker.js',
    '/qa/release-review/',
    '/agents/agentgrid-unknown-release/',
  ])
    if ((await get(path)).status !== 404)
      throw new Error('Production private/unknown route exposed.');
  // Provider aliases must never mint canonical-origin sessions.
  const identity = await get('/api/identity/');
  if (origin === productionAlias) {
    if (identity.status === 200 || identity.headers.has('set-cookie'))
      throw new Error('Provider alias must reject identity requests.');
  } else {
    const session = await identity.json();
    if (
      identity.status !== 200 ||
      identity.headers.get('cache-control') !== 'private, no-store' ||
      !identity.headers.get('set-cookie')?.includes('__Host-agentgrid_csrf=') ||
      session.signedIn !== false ||
      !/^[A-Za-z0-9_-]{43}$/.test(session.csrf ?? '') ||
      Object.keys(session).length !== 2
    )
      throw new Error('Production identity boundary unavailable.');
  }
}
