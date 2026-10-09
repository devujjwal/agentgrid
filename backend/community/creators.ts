import { providerFetch } from '../http/provider-fetch.ts';
import { createClient } from '@supabase/supabase-js';
import {
  CreatorProjectionSchema,
  CreatorUsernameSchema,
  type PublicCreator,
} from '../../src/domain/creator.ts';
import { HttpFailure } from '../http/guard.ts';
import type { publicCommunityConfiguration } from './configuration.ts';
/** Anonymous projection, independent of shared privileged identity credentials. */
export function publicCreatorData(
  configuration: ReturnType<typeof publicCommunityConfiguration>,
  transport: typeof fetch = fetch,
) {
  const client = createClient(configuration.supabaseOrigin, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (
          url.origin !== configuration.supabaseOrigin ||
          url.pathname !== '/rest/v1/rpc/agentgrid_public_creator_page' ||
          url.search ||
          init?.method !== 'POST'
        )
          throw new Error('Unexpected public creator request.');
        const response = await providerFetch(transport, input, {
          ...init,
          signal: AbortSignal.timeout(10000),
        });
        if (
          !response.ok ||
          !response.body ||
          response.headers.get('content-type')?.split(';')[0] !== 'application/json'
        )
          throw new Error('Creator source unavailable.');
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > 100000) {
              await reader.cancel();
              throw new Error('Creator projection exceeds bounds.');
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const body = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          body.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return new Response(body, { headers: { 'content-type': 'application/json' } });
      },
    },
  });
  return async (username: string, offset = 0): Promise<PublicCreator | null> => {
    if (
      !CreatorUsernameSchema.safeParse(username).success ||
      !Number.isInteger(offset) ||
      offset < 0 ||
      offset > 9980 ||
      offset % 20 !== 0
    )
      throw new HttpFailure(400, 'invalid-request');
    const result = await client.rpc('agentgrid_public_creator_page', {
      handle: username,
      requested_offset: offset,
    });
    if (result.error) throw new HttpFailure(503, 'service-unavailable');
    if (result.data === null) return null;
    const parsed = CreatorProjectionSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.username !== username)
      throw new HttpFailure(503, 'service-unavailable');
    return {
      ...parsed.data,
      agents: parsed.data.agents.slice(0, 20),
      offset,
      hasMore: parsed.data.agents.length > 20,
    };
  };
}
