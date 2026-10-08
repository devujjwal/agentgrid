import { verifySocialExport } from './verify-social-export.mjs';
/** Builds a local-only optimized preview into an ignored, nondeployment directory. */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inspectExport } from './verify-export.mjs';
import { hardenStatic } from './harden-static.mjs';

if (process.env.CI || process.env.GITHUB_ACTIONS)
  throw new Error('Local preview is forbidden in CI.');
execFileSync('pnpm', ['exec', 'next', 'build'], {
  stdio: 'inherit',
  env: { ...process.env, AGENTGRID_LOCAL_DESIGN_PREVIEW: '1', NEXT_TELEMETRY_DISABLED: '1' },
});
await hardenStatic(resolve('.agentgrid-local-preview'));
await verifySocialExport(resolve('.agentgrid-local-preview'));
const html = await readFile(resolve('.agentgrid-local-preview/index.html'), 'utf8');
if ((await inspectExport(resolve('.agentgrid-local-preview'), { localDesignPreview: true })).length)
  throw new Error('Local preview export boundary failed.');
if (!html.includes('Local design preview') || !html.includes('noindex'))
  throw new Error('Unexpected preview output.');
console.log(
  'Optimized design preview built locally. Public out/ and deployment policy remain separate.',
);
