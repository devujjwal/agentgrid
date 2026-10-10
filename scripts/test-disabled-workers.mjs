/** Local workerd RPC acceptance. Synthetic configuration; no real credentials. */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const wranglerRoot = dirname(require.resolve('wrangler/package.json'));
const { Miniflare, convertV4MiniflareOptions } = createRequire(
  resolve(wranglerRoot, 'package.json'),
)('miniflare');
let outbound = 0;
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: 'caller',
        modules: true,
        script: `export default { async fetch(_request, env) {
        return Response.json(await env.BILLING.verifiedCost('55555555-5555-4555-8555-555555555555'));
      } };`,
        serviceBindings: { BILLING: 'billing' },
        compatibilityDate: '2026-10-09',
      },
      {
        name: 'billing',
        modules: true,
        scriptPath: resolve('.agentgrid-functions/workers/agentgrid-render-billing/worker.js'),
        compatibilityDate: '2026-10-09',
        bindings: {
          AGENTGRID_EXECUTION_ENABLED: '0',
          AGENTGRID_BILLING_RECONCILIATION_ENABLED: '0',
        },
        outboundService: async () => {
          outbound++;
          return new Response(null, { status: 502 });
        },
      },
    ],
  }),
);
try {
  const caller = await mf.getWorker('caller');
  assert.equal(await (await caller.fetch('https://fixture.example/')).json(), null);
  const billing = await mf.getWorker('billing');
  assert.equal((await billing.fetch('https://fixture.example/')).status, 404);
  assert.equal(outbound, 0);
  console.log('Disabled compiled billing RPC returns null; HTTP 404; zero outbound requests.');
} finally {
  await mf.dispose();
}
