/** Manual exact-main production release. Server credentials remain encrypted at Cloudflare. */
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile, cp, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspectExport } from './verify-export.mjs';
import { readPublication } from './verify-publication.mjs';
import { assertCurrentCapture } from './promote-publication.mjs';
import { capturePublicCatalogue } from '../backend/publication/snapshot.ts';
import { publicPublicationSource } from '../backend/publication/source.ts';
import {
  productionAccount,
  productionProject,
  productionOrigin,
  productionAlias,
  productionRobots,
  productionDeploymentPlan,
  inspectProductionProject,
  assertProductionInventory,
  verifyProductionDelivery,
} from './production-policy.mjs';
let failurePhase = 'preflight';
async function main() {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const args = productionDeploymentPlan(
    process.env,
    head,
    !execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  );
  const publication = await readPublication(resolve('content/publication'));
  assertProductionInventory(
    publication,
    JSON.parse(await readFile('content/launch/reviewed-editorial.json', 'utf8')),
  );
  failurePhase = 'public-capture-comparison';
  const rpc = publicPublicationSource({
    origin: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  assertCurrentCapture(publication, await capturePublicCatalogue(rpc));
  const provider = async (path) => {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${productionAccount}/pages/projects/${productionProject}` +
        path,
      {
        headers: { Authorization: 'Bearer ' + process.env.CLOUDFLARE_API_TOKEN },
        redirect: 'error',
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok) throw new Error('Production provider inspection unavailable.');
    const data = await response.json();
    if (!data.success) throw new Error('Production provider operation failed.');
    return data.result;
  };
  const project = await provider('');
  inspectProductionProject(project, { requireBindings: true });
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])
    if (project.deployment_configs.production.env_vars[key].value !== process.env[key])
      throw new Error('Capture and delivery source differ.');
  failurePhase = 'production-build';
  execFileSync('pnpm', ['build'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180000,
    env: {
      PATH: process.env.PATH,
      ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      CI: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
      AGENTGRID_BUILD_STAGE: 'production',
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    },
  });
  if ((await inspectExport(resolve('out'))).length) throw new Error('Unsafe production export.');
  // Check again after the build; catalogue writes during compilation must not
  // turn an already-outdated capture into a production upload.
  assertCurrentCapture(publication, await capturePublicCatalogue(rpc));
  const temporary = await mkdtemp(join(tmpdir(), 'agentgrid-production-release-'));
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
      (await readFile(join(site, '_headers'), 'utf8')).replace(
        /^ {2}X-Robots-Tag: noindex, nofollow\r?\n/gm,
        '',
      ) + '\n/agentgrid-release.json\n  Cache-Control: no-store\n',
    );
    await writeFile(join(site, 'robots.txt'), productionRobots);
    if ((await inspectExport(site)).length)
      throw new Error('Assembled release failed the private-artifact boundary.');
    const output = join(temporary, 'receipt.jsonl');
    // Run outside the repository so Wrangler cannot discover setup env files or
    // rebuild a different functions directory. Deploy the tested advanced Worker.
    const cli = resolve('node_modules/wrangler/bin/wrangler.js');
    failurePhase = 'upload';
    execFileSync(process.execPath, [cli, ...args], {
      cwd: temporary,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180000,
      env: {
        PATH: process.env.PATH,
        ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
        CI: 'true',
        CLOUDFLARE_ACCOUNT_ID: productionAccount,
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
    failurePhase = 'deployment-receipt';
    const records = (await readFile(output, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    const receipt = records.find((item) => item.type === 'pages-deploy-detailed');
    if (
      !receipt ||
      receipt.pages_project !== productionProject ||
      receipt.environment !== 'production' ||
      receipt.production_branch !== 'main' ||
      receipt.deployment_trigger?.metadata?.commit_hash !== head ||
      !/^[a-f0-9-]{36}$/.test(receipt.deployment_id)
    )
      throw new Error('Unexpected deployment receipt.');
    failurePhase = 'provider-readback';
    const deployed = await provider('/deployments/' + receipt.deployment_id);
    const current = await provider('');
    inspectProductionProject(current, { requireBindings: true });
    if (
      deployed.latest_stage?.status !== 'success' ||
      deployed.deployment_trigger?.metadata?.commit_hash !== head ||
      current.canonical_deployment?.id !== receipt.deployment_id
    )
      throw new Error('Provider has not confirmed the current exact build.');
    failurePhase = 'delivery-readback';
    await verifyProductionDelivery(proof, productionAlias);
    await verifyProductionDelivery(proof, productionOrigin);
    for (const resource of publication.catalogue.resources) {
      const response = await fetch(
        productionOrigin + '/agents/' + resource.specification.identity.slug + '/',
        {
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        },
      );
      if (
        response.status !== 200 ||
        /noindex/.test(response.headers.get('x-robots-tag') ?? '') ||
        !(await response.text()).includes(resource.specification.identity.name)
      )
        throw new Error(
          'Released resource is not served by the current production delivery guard.',
        );
    }
    // Receipt contains no account credentials and is retained by the private workflow.
    failurePhase = 'receipt-retention';
    await writeFile(
      'production-release-receipt.json',
      JSON.stringify(
        {
          ...proof,
          deployment_id: receipt.deployment_id,
          origin: productionOrigin,
          verified_at: new Date().toISOString(),
        },
        null,
        2,
      ) + '\n',
      { flag: 'wx' },
    );
    console.log(
      `Verified production deployment ${receipt.deployment_id} for ${head}. Canonical production delivery verified.`,
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
      `Production release was not verified (${failurePhase}). Inspect provider state before retrying; an interrupted deployment may have completed. No automatic rollback or raw provider/credential output.`,
    );
    process.exitCode = 1;
  }
}
