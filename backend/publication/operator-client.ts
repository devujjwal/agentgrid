/** Local trusted publisher only. This module is never a Pages route or build input. */
import { createClient } from '@supabase/supabase-js';
import { publicCommunityConfiguration } from '../community/configuration.ts';

export function releaseOperatorClient(
  environment: Record<string, unknown>,
  allowPublish: boolean,
  transport: typeof fetch = fetch,
) {
  const configuration = publicCommunityConfiguration(environment);
  const key = environment.SUPABASE_SECRET_KEY;
  if (typeof key !== 'string' || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))
    throw new Error('Explicit publisher credential required.');
  const allowed = new Set([
    '/rest/v1/rpc/agentgrid_prepare_release_request',
    '/rest/v1/rpc/agentgrid_release_request_status',
    ...(allowPublish ? ['/rest/v1/rpc/agentgrid_execute_release_request'] : []),
  ]);
  return createClient(configuration.supabaseOrigin, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        if (
          url.origin !== configuration.supabaseOrigin ||
          url.username ||
          url.password ||
          url.search ||
          url.hash ||
          !allowed.has(url.pathname) ||
          init?.method !== 'POST'
        )
          throw new Error('Unexpected publisher operation.');
        const response = await transport(input, {
          ...init,
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        });
        if (
          !response.ok ||
          !response.body ||
          response.headers.get('content-type')?.split(';')[0] !== 'application/json'
        ) {
          await response.body?.cancel();
          throw new Error(
            'Publisher response unavailable. Inspect the recorded outcome before any retry.',
          );
        }
        const maximum = 3_000_000;
        const length = response.headers.get('content-length');
        if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) {
          await response.body.cancel();
          throw new Error('Publisher response exceeds bounds.');
        }
        const reader = response.body.getReader(),
          chunks: Uint8Array[] = [];
        let size = 0;
        try {
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > maximum) {
              await reader.cancel();
              throw new Error('Publisher response exceeds bounds.');
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
        return new Response(body, { headers: { 'Content-Type': 'application/json' } });
      },
    },
  });
}
