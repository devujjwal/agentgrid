import { WorkerEntrypoint } from 'cloudflare:workers';
import { verifiedRenderCost } from './reconcile.ts';

export default class BillingReconciler extends WorkerEntrypoint {
  async verifiedCost(taskId) {
    return verifiedRenderCost(taskId, {
      enabled: () =>
        this.env.AGENTGRID_EXECUTION_ENABLED === '1' &&
        this.env.AGENTGRID_BILLING_RECONCILIATION_ENABLED === '1',
      bucket: this.env.AGENTGRID_BILLING_EVIDENCE,
      providerOwner: this.env.AGENTGRID_SHOTSTACK_OWNER,
      apiKey: this.env.SHOTSTACK_API_KEY,
      transport: fetch,
    });
  }

  async fetch() {
    return new Response(null, { status: 404 });
  }
}
