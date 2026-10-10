import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const configs = ['backend/billing/wrangler.jsonc', 'backend/execution/wrangler.jsonc'];
const flags = [
  'AGENTGRID_EXECUTION_ENABLED',
  'AGENTGRID_REEL_GENERATION_ENABLED',
  'AGENTGRID_SOCIAL_PUBLISHING_ENABLED',
  'AGENTGRID_SOCIAL_OAUTH_ENABLED',
  'AGENTGRID_SOCIAL_SCHEDULER_ENABLED',
];
for (const config of configs) {
  // These repository-owned configs contain no comments, only optional trailing commas.
  const value = JSON.parse(
    readFileSync(resolve(root, config), 'utf8').replace(/,\s*([}\]])/g, '$1'),
  );
  const expected = config.includes('/billing/')
    ? ['AGENTGRID_EXECUTION_ENABLED', 'AGENTGRID_BILLING_RECONCILIATION_ENABLED']
    : flags;
  if (
    value.workers_dev !== false ||
    value.preview_urls !== false ||
    value.routes?.length ||
    expected.some((name) => value.vars?.[name] !== '0')
  ) {
    throw Error('Worker packaging requires private routes and every execution flag disabled.');
  }
  const output = resolve(root, '.agentgrid-functions/workers', value.name);
  mkdirSync(output, { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      resolve(root, 'node_modules/wrangler/bin/wrangler.js'),
      'deploy',
      '--dry-run',
      '--config',
      resolve(root, config),
      '--outdir',
      output,
    ],
    {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false', WRANGLER_SEND_ERROR_REPORTS: 'false' },
    },
  );
  if (result.status !== 0) throw Error('Disabled Worker packaging failed.');
}
