import { z } from 'zod';
import type { IdentityRuntime } from '../auth/runtime.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { workspaceData } from '../workspace/data.ts';
import { executionStore } from '../execution/store.ts';
import { estimateTextCost, runtimeProviderIdentity } from '../execution/openai.ts';
import { prepareTextRun } from '../execution/text-run.ts';
import { RunRequestSchema } from '../execution/contracts.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';
const ConfirmationSchema = z.strictObject({
  id: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
const CancelSchema = z.strictObject({ id: z.uuid() });
export function executionHandler(
  runtime: IdentityRuntime,
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      if (url.search) throw new HttpFailure(400, 'invalid-request');
      const read = url.pathname === '/api/execution/';
      if (
        !read &&
        !['/api/execution/prepare/', '/api/execution/approve/', '/api/execution/cancel/'].includes(
          url.pathname,
        )
      )
        throw new HttpFailure(404, 'not-found');
      if (read) {
        if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
        if (
          request.headers.has('sec-fetch-site') &&
          request.headers.get('sec-fetch-site') !== 'same-origin'
        )
          throw new HttpFailure(403, 'request-refused');
      } else await assertCsrf(runtime, request);
      const session = await authenticatedSession(runtime, request);
      const identity = await workspaceData(
        runtime.configuration,
        session.provider,
        transport,
      ).identity();
      if (identity.profile?.status !== 'active') throw new HttpFailure(403, 'request-refused');
      const enabled = environment.AGENTGRID_EXECUTION_ENABLED === '1';
      if (!enabled) {
        if (!read) throw new HttpFailure(503, 'service-unavailable');
        return privateJson({
          enabled: false,
          agents: [],
          runs: [],
          budget: { limitMicros: 0, heldMicros: 0, spentMicros: 0 },
        });
      }
      const client = executionStore(environment, session.provider.subject, transport);
      if (read) return privateJson(await client.overview());
      const body = await readJsonBody(request, 40_000);
      if (url.pathname === '/api/execution/prepare/') {
        const parsed = RunRequestSchema.safeParse(body);
        if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(
          await prepareTextRun({
            enabled,
            actor: { profileId: identity.profile.id, active: true },
            request: parsed.data,
            resource: await client.source(parsed.data.versionId),
            store: client.store,
            provider: {
              identity: runtimeProviderIdentity,
              estimate: estimateTextCost,
              generate: async () => {
                throw new Error('Dispatch requires worker.');
              },
            },
          }),
          201,
        );
      }
      if (url.pathname === '/api/execution/cancel/') {
        const parsed = CancelSchema.safeParse(body);
        if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await client.cancel(parsed.data.id));
      }
      const parsed = ConfirmationSchema.safeParse(body);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const queue = environment.AGENTGRID_EXECUTION_QUEUE as
        { send?: (body: unknown) => Promise<void> } | undefined;
      if (!queue || typeof queue.send !== 'function')
        throw new HttpFailure(503, 'service-unavailable');
      const run = await client.approve(parsed.data.id, parsed.data.digest);
      await queue.send({ subject: session.provider.subject, runId: run.id, digest: run.digest });
      return privateJson(run, 202);
    } catch (error) {
      return privateFailure(error);
    }
  };
}
