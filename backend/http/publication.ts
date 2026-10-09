import type { IdentityRuntime } from '../auth/runtime.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import type { WorkspaceIdentity } from '../../src/domain/workspace.ts';
import type { PublicationClient } from '../publication/release.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import { assertCsrf } from '../auth/csrf.ts';
import {
  PublicationOperationSchema,
  PublicationResultSchema,
} from '../../src/domain/publication-operation.ts';
import { runReleaseAction } from '../publication/operator.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';

export function publicationHandler(
  runtime: IdentityRuntime,
  identity: (session: ProviderSession) => Promise<WorkspaceIdentity>,
  client: (subject: string) => PublicationClient,
  enabled: boolean,
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      if (!enabled || url.pathname !== '/api/admin/publication/')
        throw new HttpFailure(404, 'not-found');
      if (url.search) throw new HttpFailure(400, 'invalid-request');
      await assertCsrf(runtime, request);
      const session = await authenticatedSession(runtime, request);
      const member = await identity(session.provider);
      if (member.profile?.status !== 'active' || !member.roles.includes('administrator'))
        throw new HttpFailure(403, 'request-refused');
      const plan = PublicationOperationSchema.safeParse(await readJsonBody(request, 1500));
      if (!plan.success) throw new HttpFailure(400, 'invalid-request');
      // Only persisted, immutable observations reach the quality gate. A caller
      // may select an existing request and fingerprint, never submit a manifest.
      return privateJson(
        PublicationResultSchema.parse(
          await runReleaseAction(
            client(session.provider.subject),
            plan.data,
            new Date(runtime.now() * 1000),
          ),
        ),
      );
    } catch (error) {
      return privateFailure(error);
    }
  };
}
