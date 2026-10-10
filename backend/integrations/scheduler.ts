import { z } from 'zod';
import { mediaCapabilities } from '../execution/media-controls.ts';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { providerJson } from './http.ts';
const JobSchema = z.strictObject({
  kind: z.literal('publish'),
  subject: z.uuid(),
  id: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
/** Repeated scans recover queue-send failures. Atomic delivery claim prevents duplicate posts. */
export async function enqueueDuePublications(
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
) {
  if (
    !mediaCapabilities(environment).publish ||
    environment.AGENTGRID_SOCIAL_SCHEDULER_ENABLED !== '1'
  )
    return;
  const configuration = publicCommunityConfiguration(environment);
  const key = z
    .string()
    .regex(/^sb_secret_[A-Za-z0-9_-]{20,}$/)
    .parse(environment.SUPABASE_SECRET_KEY);
  const queue = environment.AGENTGRID_EXECUTION_QUEUE as
    { send?: (body: unknown) => Promise<void> } | undefined;
  if (!queue?.send) throw new Error('Publication queue unavailable.');
  const jobs = z
    .array(JobSchema)
    .max(50)
    .parse(
      (
        await providerJson(
          transport,
          configuration.supabaseOrigin + '/rest/v1/rpc/agentgrid_due_social_jobs',
          {
            method: 'POST',
            headers: {
              apikey: key,
              Authorization: 'Bearer ' + key,
              'Content-Type': 'application/json',
            },
            body: '{}',
            signal: AbortSignal.timeout(15000),
          },
        )
      ).body,
    );
  for (const job of jobs) await queue.send(job);
}
