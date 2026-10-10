import { enqueueDuePublications } from '../integrations/scheduler.ts';
import { dispatchMediaJob } from '../integrations/dispatch.ts';
import { z } from 'zod';
import { executionStore } from './store.ts';
import { openaiTextProvider } from './openai.ts';
import { executeTextRun } from './text-run.ts';
import { ExecutionError } from './contracts.ts';
const JobSchema = z.strictObject({
  subject: z.uuid(),
  runId: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
interface Message {
  body: unknown;
  ack(): void;
  retry(): void;
}
export default {
  async scheduled(_event: unknown, env: Record<string, unknown>) {
    await enqueueDuePublications(env);
  },
  async queue(batch: { messages: Message[] }, env: Record<string, unknown>) {
    if (env.AGENTGRID_EXECUTION_ENABLED !== '1') {
      for (const message of batch.messages) message.ack();
      return;
    }
    for (const message of batch.messages) {
      // Media mutations are never automatically redelivered after an ambiguous outcome.
      if (message.body && typeof message.body === 'object' && 'kind' in message.body) {
        try {
          const billing = env.AGENTGRID_RENDER_BILLING as
            { verifiedCost?: (taskId: string) => Promise<number | null> } | undefined;
          await dispatchMediaJob(
            message.body,
            env,
            billing?.verifiedCost
              ? { verifiedBilledCost: (taskId) => billing.verifiedCost!(taskId) }
              : {},
          );
        } catch {
          /* Private history retains the task/receipt for explicit reconciliation. */
        }
        message.ack();
        continue;
      }
      const parsed = JobSchema.safeParse(message.body);
      if (!parsed.success || env.AGENTGRID_EXECUTION_ENABLED !== '1') {
        message.ack();
        continue;
      }
      try {
        const client = executionStore(env, parsed.data.subject);
        const record = await client.store.read('', parsed.data.runId);
        if (!record) {
          message.ack();
          continue;
        }
        if (typeof env.OPENAI_API_KEY !== 'string')
          throw new Error('Provider configuration unavailable.');
        await executeTextRun({
          enabled: true,
          actor: { profileId: record.ownerId, active: true },
          runId: record.id,
          approvedDigest: parsed.data.digest,
          provider: openaiTextProvider(env.OPENAI_API_KEY),
          store: client.store,
        });
        message.ack();
      } catch (error) {
        // The store prevents redispatch after claim. Provider failures are final
        // uncertain outcomes, so queue retries only recover infrastructure reads.
        if (error instanceof ExecutionError) message.ack();
        else message.retry();
      }
    }
  },
};
