import { z } from 'zod';
import type { PublicationClient } from './release.ts';
import { releaseOperatorClient } from './operator-client.ts';

/** The actor comes from verified managed identity, never from the request body.
 * SQL checks current AgentGrid administrator authority within its transaction.
 */
export function serverPublicationClient(
  environment: Record<string, unknown>,
  actor: string,
  transport: typeof fetch = fetch,
) {
  z.uuid().parse(actor);
  const client = releaseOperatorClient(environment, false, transport, true);
  const actions: Record<string, string> = {
    agentgrid_prepare_release_request: 'prepare',
    agentgrid_release_request_status: 'inspect',
    agentgrid_execute_release_request: 'publish',
  };
  return {
    rpc: async (name: string, input: Record<string, unknown>) => {
      const action = actions[name];
      if (!action || !z.uuid().safeParse(input.request_id).success)
        throw new Error('Unexpected publication operation.');
      return client.rpc('agentgrid_server_publication', {
        actor_user_id: actor,
        operation: action,
        request_id: input.request_id,
        evidence: action === 'publish' ? input.evidence : null,
      });
    },
  } satisfies PublicationClient;
}
