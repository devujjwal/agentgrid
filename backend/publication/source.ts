import { providerFetch } from '../http/provider-fetch.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { PublicPublicationRpc } from './snapshot.ts';
const SourceConfiguration = z.strictObject({
  origin: z.string().regex(/^https:\/\/[a-z0-9]+\.supabase\.co$/),
  key: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{20,}$/),
});
const names = [
  'agentgrid_publication_index',
  'agentgrid_public_resource',
  'agentgrid_public_lineage',
  'agentgrid_public_delivery_state',
] as const;
/** Public-only, bounded transport. Shared-project privileged credentials are refused. */
export function publicPublicationSource(
  configuration: unknown,
  transport: typeof fetch = fetch,
): PublicPublicationRpc {
  const value = SourceConfiguration.parse(configuration);
  const client = createClient(value.origin, value.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (
          url.origin !== value.origin ||
          !names.some((name) => url.pathname === '/rest/v1/rpc/' + name) ||
          url.search ||
          init?.method !== 'POST'
        )
          throw new Error('Unexpected public capture request.');
        const response = await providerFetch(transport, input, {
          ...init,
          signal: AbortSignal.timeout(15000),
        });
        if (
          !response.ok ||
          response.headers.get('content-type')?.split(';')[0] !== 'application/json'
        )
          throw new Error('Public publication source unavailable.');
        const size = response.headers.get('content-length');
        if (size && (!/^\d+$/.test(size) || Number(size) > 300000))
          throw new Error('Public source response exceeds bounds.');
        if (!response.body) throw new Error('Public source response is empty.');
        const reader = response.body.getReader(),
          parts: Uint8Array[] = [];
        let bytes = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            bytes += chunk.value.byteLength;
            if (bytes > 300000) {
              await reader.cancel();
              throw new Error('Public source response exceeds bounds.');
            }
            parts.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        const result = new Uint8Array(bytes);
        let offset = 0;
        for (const part of parts) {
          result.set(part, offset);
          offset += part.byteLength;
        }
        return new Response(result, {
          status: response.status,
          headers: { 'content-type': 'application/json' },
        });
      },
    },
  });
  return async (name, body) => {
    if (!names.includes(name)) throw new Error('Only public capture RPCs are permitted.');
    const result = await client.rpc(name, body);
    if (result.error)
      throw new Error('Public publication source unavailable; no candidate was accepted.');
    return result.data;
  };
}
