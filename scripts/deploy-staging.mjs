/** Manual exact-main staging release. Server credentials remain encrypted at Cloudflare. */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, cp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectExport } from './verify-export.mjs';
import { verifyDocumentPolicy } from './static-csp.mjs';
import { documentHeaderPolicy } from '../src/domain/document-security.ts';
import { readPublication } from './verify-publication.mjs';
import { assertCurrentCapture } from './promote-publication.mjs';
import { capturePublicCatalogue } from '../backend/publication/snapshot.ts';
import { publicPublicationSource } from '../backend/publication/source.ts';
import { inspectStagingProject, stagingAccount, stagingProject } from './configure-staging.mjs';
export const stagingOrigin = 'https://agentgrid-staging.pages.dev';
export function stagingDeploymentPlan(environment, head, clean) {
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== 'devujjwal/agentgrid' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
    !/^[a-f0-9]{40}$/.test(head) ||
    environment.GITHUB_SHA !== head ||
    environment.RELEASE_COMMIT !== head ||
    !clean ||
    environment.CLOUDFLARE_ACCOUNT_ID !== stagingAccount ||
    !environment.CLOUDFLARE_API_TOKEN ||
    /[\r\n]/.test(environment.CLOUDFLARE_API_TOKEN)
  )
    throw new Error('Exact clean manual-main personal staging release required.');
  return [
    'pages',
    'deploy',
    'site',
    '--project-name',
    stagingProject,
    '--branch',
    'main',
    '--commit-hash',
    head,
    '--commit-dirty=false',
    '--no-bundle',
  ];
}
export function assertStagingBindings(project) {
  inspectStagingProject(project);
  const bindings = project.deployment_configs.production.env_vars;
  for (const key of [
    'SUPABASE_SECRET_KEY',
    'RESEND_API_KEY',
    'AGENTGRID_ENVELOPE_KEYS',
    'AGENTGRID_RATE_KEY',
    'AGENTGRID_PILOT_EMAILS',
  ])
    if (bindings[key]?.type !== 'secret_text')
      throw new Error('Staging server bindings are not ready.');
  for (const key of [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'RESEND_FROM_EMAIL',
  ])
    if (bindings[key]?.type !== 'plain_text' || !bindings[key].value)
      throw new Error('Staging public configuration is incomplete.');
}
export async function verifyStagingDelivery(expected, transport = fetch) {
  const get = (path) =>
    transport(stagingOrigin + path, {
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
    });
  for (const path of ['/', '/sign-in/']) {
    const response = await get(path);
    if (
      response.status !== 200 ||
      response.headers.get('content-security-policy') !== documentHeaderPolicy ||
      response.headers.get('x-content-type-options') !== 'nosniff' ||
      !/noindex/.test(response.headers.get('x-robots-tag') ?? '') ||
      !response.headers.get('x-frame-options')?.includes('DENY')
    )
      throw new Error('Staging HTML/headers failed.');
    const html = await response.text();
    if (!html.includes('AgentGrid')) throw new Error('Unexpected staging document.');
    verifyDocumentPolicy(html);
  }
  const proof = await get('/agentgrid-release.json');
  if (proof.status !== 200 || JSON.stringify(await proof.json()) !== JSON.stringify(expected))
    throw new Error('Staging build identity differs.');
  const identity = await get('/api/identity/');
  if (
    identity.status !== 200 ||
    identity.headers.get('cache-control') !== 'private, no-store' ||
    !identity.headers.get('set-cookie')?.includes('__Host-agentgrid_csrf=')
  )
    throw new Error('Staging identity boundary unavailable.');
  const session = await identity.json();
  if (
    session.signedIn !== false ||
    !/^[A-Za-z0-9_-]{43}$/.test(session.csrf ?? '') ||
    Object.keys(session).length !== 2
  )
    throw new Error('Unexpected anonymous identity state.');
  for (const path of [
    '/workspace-does-not-exist/',
    '/qa/release-review/',
    '/_worker.js',
    '/.env',
    '/agents/agentgrid-unknown-release/',
  ])
    if ((await get(path)).status !== 404)
      throw new Error('Staging private/unknown route boundary failed.');
  const robots = await get('/robots.txt');
  if (robots.status !== 200 || !/Disallow:\s*\//.test(await robots.text()))
    throw new Error('Staging crawler exclusion failed.');
}
async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const args = stagingDeploymentPlan(
    process.env,
    head,
    !execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  );
  if ((await inspectExport(resolve('out'))).length) throw new Error('Unsafe static export.');
  const publication = await readPublication(resolve('content/publication'));
  const rpc = publicPublicationSource({
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  assertCurrentCapture(publication, await capturePublicCatalogue(rpc));
  const provider = async (path) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${stagingAccount}/pages/projects/${stagingProject}` +
        path,
      {
        headers: { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new Error('Staging provider inspection unavailable.');
    const data = await response.json();
    if (!data.success) throw new Error('Staging provider operation failed.');
    return data.result;
  };
  const project = await provider('');
  assertStagingBindings(project);
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
    if (project.deployment_configs.production.env_vars[key].value !== process.env[key])
      throw new Error('Capture and delivery source differ.');
  const temporary = await mkdtemp(join(tmpdir(), 'agentgrid-staging-release-'));
  try {
    const site = join(temporary, 'site');
    await cp('out', site, { recursive: true, errorOnExist: true });
    await copyFile('.agentgrid-functions/index.js', join(site, '_worker.js'));
    await copyFile('.agentgrid-functions/_routes.json', join(site, '_routes.json'));
    const proof = {
      contract_version: '0.1',
      commit: head,
      catalogue_sha256: publication.delivery.catalogue_sha256,
      source_revision: publication.delivery.source_revision,
    };
    await writeFile(join(site, 'agentgrid-release.json'), JSON.stringify(proof) + '\n');
    await writeFile(
      join(site, '_headers'),
      (await readFile(join(site, '_headers'), 'utf8')) +
        '\n/agentgrid-release.json\n  Cache-Control: no-store\n',
    );
    if ((await inspectExport(site)).length)
      throw new Error('Assembled release failed the private-artifact boundary.');
    const output = join(temporary, 'receipt.jsonl');
    // Run outside the repository so Wrangler cannot discover setup env files or
    // rebuild a different functions directory. Deploy the tested advanced Worker.
    const cli = resolve('node_modules/wrangler/bin/wrangler.js');
    execFileSync(process.execPath, [cli, ...args], {
      cwd: temporary,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      env: {
        PATH: process.env.PATH,
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        CI: 'true',
        CLOUDFLARE_ACCOUNT_ID: stagingAccount,
        CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,
        NODE_USE_SYSTEM_CA: '1',
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_SEND_ERROR_REPORTS: 'false',
        WRANGLER_LOG_SANITIZE: 'true',
        WRANGLER_LOG_PATH: join(temporary, 'wrangler.log'),
        WRANGLER_OUTPUT_FILE_PATH: output,
        CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
      },
    });
    const records = (await readFile(output, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const receipt = records.find((item) => item.type === 'pages-deploy-detailed');
    if (
      !receipt ||
      receipt.pages_project !== stagingProject ||
      receipt.environment !== 'production' ||
      receipt.production_branch !== 'main' ||
      receipt.deployment_trigger?.metadata?.commit_hash !== head ||
      !/^[a-f0-9-]{36}$/.test(receipt.deployment_id)
    )
      throw new Error('Unexpected deployment receipt.');
    const deployed = await provider('/deployments/' + receipt.deployment_id);
    const current = await provider('');
    assertStagingBindings(current);
    if (
      deployed.latest_stage?.status !== 'success' ||
      deployed.deployment_trigger?.metadata?.commit_hash !== head ||
      current.canonical_deployment?.id !== receipt.deployment_id
    )
      throw new Error('Provider has not confirmed the current exact build.');
    await verifyStagingDelivery(proof);
    // Receipt contains no account credentials and is retained by the private workflow.
    await writeFile(
      'staging-release-receipt.json',
      JSON.stringify(
        {
          ...proof,
          deployment_id: receipt.deployment_id,
          origin: stagingOrigin,
          verified_at: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    console.log(
      `Verified staging deployment ${receipt.deployment_id} for ${head}. Production domain unchanged.`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    await main();
  } catch {
    console.error(
      'Staging release was not verified. Inspect provider state before retrying; an interrupted deployment may have completed. No automatic rollback or raw provider/credential output.',
    );
    process.exitCode = 1;
  }
}
