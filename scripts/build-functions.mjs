/** Compile the server boundary independently of the public static export.
 * This command does not deploy, authenticate or read private local credentials.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = resolve('.agentgrid-functions');
await mkdir(root, { recursive: true });
execFileSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'pages',
    'functions',
    'build',
    'functions',
    '--outdir',
    root,
    '--minify',
    '--compatibility-date',
    '2026-10-07',
    '--output-routes-path',
    resolve(root, '_routes.json'),
  ],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: 'false',
      WRANGLER_LOG_PATH: resolve(root, 'build.log'),
    },
  },
);
const routes = JSON.parse(await readFile(resolve(root, '_routes.json'), 'utf8'));
if (
  routes.version !== 1 ||
  !Array.isArray(routes.include) ||
  routes.include.length !== 4 ||
  !routes.include.includes('/api/*') ||
  !routes.include.includes('/auth/callback') ||
  !routes.include.includes('/agents/*') ||
  !routes.include.includes('/creators/*')
)
  throw new Error('Unexpected Worker invocation routes.');
const bytes = (await stat(resolve(root, 'index.js'))).size;
if (bytes > 1_500_000) throw new Error('Identity Worker exceeds its bundle budget.');
console.log(
  `Server boundary compiled: ${bytes} bytes; API, OAuth callback and guarded agent routes invoke it.`,
);
