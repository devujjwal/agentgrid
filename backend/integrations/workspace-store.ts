import { z } from 'zod';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { providerJson } from './http.ts';
import { MediaOverviewSchema } from '../../src/domain/media-workspace.ts';
export function mediaWorkspaceStore(
  environment: Record<string, unknown>,
  subject: string,
  transport: typeof fetch = fetch,
) {
  z.uuid().parse(subject);
  const configuration = publicCommunityConfiguration(environment);
  const secret = z
    .string()
    .regex(/^sb_secret_[A-Za-z0-9_-]{20,}$/)
    .parse(environment.SUPABASE_SECRET_KEY);
  async function rpc(operation: string, evidence: unknown = {}) {
    return (
      await providerJson(
        transport,
        configuration.supabaseOrigin + '/rest/v1/rpc/agentgrid_server_media_workspace',
        {
          method: 'POST',
          headers: {
            apikey: secret,
            Authorization: 'Bearer ' + secret,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ actor_user_id: subject, operation, evidence }),
          signal: AbortSignal.timeout(15000),
        },
      )
    ).body;
  }
  return {
    overview: async () => MediaOverviewSchema.parse(await rpc('overview')),
    mutate: async (
      operation: 'enable-connection' | 'disable-connection' | 'cancel-publication',
      body: unknown,
    ) => {
      await rpc(operation, body);
    },
  };
}
