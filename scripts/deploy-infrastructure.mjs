/** Phase 0 only. Product releases need their own publishing/launch acceptance gate. */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectExport } from './verify-export.mjs';

const ACCOUNT = 'b26860f18457e76742260d8bb979134f';
const PROJECT = 'agentgrid-infrastructure';
const PUBLIC_ORIGIN = `https://${PROJECT}.pages.dev`;
const API_ORIGIN = 'https://api.cloudflare.com/client/v4';

export function deploymentPlan(environment, head, clean) {
  if (
    environment.GITHUB_ACTIONS !== 'true' ||
    environment.GITHUB_REPOSITORY !== 'devujjwal/agentgrid' ||
    environment.GITHUB_REF !== 'refs/heads/main' ||
    environment.GITHUB_EVENT_NAME !== 'workflow_dispatch'
  )
    throw new Error('Only a manual main-branch release from private AgentGrid CI is allowed.');
  if (
    !/^[a-f0-9]{40}$/.test(head) ||
    environment.GITHUB_SHA !== head ||
    environment.RELEASE_COMMIT !== head ||
    !clean
  )
    throw new Error('Release commit must exactly match the clean validated checkout.');
  if (
    environment.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT ||
    !environment.CLOUDFLARE_API_TOKEN ||
    /[\r\n]/.test(environment.CLOUDFLARE_API_TOKEN)
  )
    throw new Error('Approved personal deployment configuration is required.');
  return [
    'exec',
    'wrangler',
    'pages',
    'deploy',
    'out',
    '--project-name',
    PROJECT,
    '--branch',
    'main',
    '--commit-hash',
    head,
    '--commit-dirty=false',
  ];
}

async function provider(path, token) {
  const response = await fetch(
    API_ORIGIN + `/accounts/${ACCOUNT}/pages/projects/${PROJECT}` + path,
    {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error('Cloudflare project inspection failed; provider details withheld.');
  const data = await response.json();
  if (!data.success)
    throw new Error('Cloudflare inspection did not succeed; provider details withheld.');
  return data.result;
}

export async function verifyInfrastructureDelivery(fetcher = fetch) {
  const get = (path) =>
    fetcher(PUBLIC_ORIGIN + path, { redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const response = await get('/');
  if (
    response.status !== 200 ||
    !response.headers.get('content-security-policy') ||
    response.headers.get('x-content-type-options') !== 'nosniff' ||
    !/noindex/.test(response.headers.get('x-robots-tag') ?? '')
  )
    throw new Error('Infrastructure delivery or security headers failed.');
  if (!(await response.text()).includes('AgentGrid infrastructure verification'))
    throw new Error('Unexpected deployed content.');
  if ((await get('/agentgrid-infrastructure-404-check/')).status !== 404)
    throw new Error('Unknown routes must return 404.');
  const robots = await get('/robots.txt');
  if (robots.status !== 200 || !/Disallow:\s*\//.test(await robots.text()))
    throw new Error('Infrastructure must exclude crawlers.');
}

async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const clean = !execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim();
  const args = deploymentPlan(process.env, head, clean);
  const errors = await inspectExport(resolve('out'));
  if (errors.length) throw new Error('Export gate failed; deployment refused.');
  const index = await readFile('out/index.html', 'utf8');
  const headers = await readFile('out/_headers', 'utf8');
  if (
    !index.includes('AgentGrid infrastructure verification') ||
    !headers.includes('X-Robots-Tag: noindex, nofollow')
  )
    throw new Error('This workflow may publish only the noindex infrastructure proof.');
  for (const path of ['functions', 'out/_worker.js', 'out/_worker.js/index.js']) {
    let exists = false;
    try {
      await access(path);
      exists = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (exists)
      throw new Error('Backend delivery is outside this infrastructure-only release gate.');
  }
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const project = await provider('', token);
  if (
    project.name !== PROJECT ||
    project.production_branch !== 'main' ||
    project.subdomain !== `${PROJECT}.pages.dev` ||
    project.domains?.length !== 1 ||
    project.domains[0] !== `${PROJECT}.pages.dev`
  )
    throw new Error('Infrastructure destination changed; deployment refused.');
  const temporary = await mkdtemp(join(tmpdir(), 'agentgrid-release-'));
  try {
    const output = join(temporary, 'wrangler-output.jsonl');
    // Do not pass database/email/Google credentials or arbitrary Wrangler overrides.
    const env = {
      PATH: process.env.PATH,
      ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      CI: 'true',
      CLOUDFLARE_ACCOUNT_ID: ACCOUNT,
      CLOUDFLARE_API_TOKEN: token,
      NODE_USE_SYSTEM_CA: '1',
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_SEND_ERROR_REPORTS: 'false',
      WRANGLER_LOG_SANITIZE: 'true',
      WRANGLER_LOG_PATH: join(temporary, 'wrangler.log'),
      WRANGLER_OUTPUT_FILE_PATH: output,
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
    };
    execFileSync('pnpm', args, { env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 });
    const records = (await readFile(output, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const receipt = records.find((record) => record.type === 'pages-deploy-detailed');
    if (
      !receipt ||
      receipt.pages_project !== PROJECT ||
      receipt.environment !== 'production' ||
      receipt.production_branch !== 'main' ||
      receipt.deployment_trigger?.metadata?.commit_hash !== head ||
      !/^[a-f0-9-]{36}$/.test(receipt.deployment_id)
    )
      throw new Error('Deployment receipt does not match the approved release.');
    const observed = await provider('/deployments/' + receipt.deployment_id, token);
    if (
      observed.environment !== 'production' ||
      observed.latest_stage?.status !== 'success' ||
      observed.deployment_trigger?.metadata?.commit_hash !== head
    )
      throw new Error('Provider has not confirmed the exact release as successful.');
    await verifyInfrastructureDelivery();
    console.log(
      `Infrastructure release verified: ${head} at ${PUBLIC_ORIGIN}/. Production domain remains unconfigured.`,
    );
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  try {
    await main();
  } catch {
    // Raw CLI/network errors can include credentials or sensitive provider details.
    console.error(
      'Infrastructure release failed safely; inspect configuration/provider state. No raw credential-bearing output logged.',
    );
    process.exitCode = 1;
  }
}
