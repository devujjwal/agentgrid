import { z } from 'zod';
import { StoredRunSchema, ExecutionOverviewSchema } from '../../src/domain/execution.ts';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import type { RunStore, RunRecord, RuntimePackage } from './contracts.ts';

export function executionStore(
  environment: Record<string, unknown>,
  subject: string,
  transport: typeof fetch = fetch,
) {
  z.uuid().parse(subject);
  const configuration = publicCommunityConfiguration(environment);
  const key = environment.SUPABASE_SECRET_KEY;
  if (typeof key !== 'string' || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))
    throw new Error('Execution storage unavailable.');
  const secret = key;
  async function rpc(operation: string, evidence: unknown = {}) {
    const response = await providerFetch(
      transport,
      configuration.supabaseOrigin + '/rest/v1/rpc/agentgrid_server_execution',
      {
        method: 'POST',
        headers: {
          apikey: secret,
          Authorization: 'Bearer ' + secret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actor_user_id: subject, operation, evidence }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error('Execution storage unavailable.');
    }
    const reader = response.body.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        // Twenty bounded records can contain up to 8.2 MB of JSON-escaped text.
        if (size > 10_000_000) {
          await reader.cancel();
          throw new Error('Execution response exceeds bounds.');
        }
        chunks.push(chunk.value);
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown;
  }
  const store: RunStore = {
    createOrRead: async (record: RunRecord) => StoredRunSchema.parse(await rpc('prepare', record)),
    read: async (_owner, id) => StoredRunSchema.nullable().parse(await rpc('read', { id })),
    claim: async (_owner, id, digest) => z.boolean().parse(await rpc('claim', { id, digest })),
    finish: async (_owner, id, state, output, billedMicros) => {
      await rpc('finish', { id, state, output, billedMicros });
    },
  };
  return {
    store,
    overview: async () => ExecutionOverviewSchema.parse(await rpc('overview')),
    source: async (versionId: string): Promise<RuntimePackage> =>
      z
        .strictObject({
          versionId: z.uuid(),
          published: z.boolean(),
          executionApproved: z.boolean(),
          specification: z.unknown(),
        })
        .parse(await rpc('source', { versionId })),
    approve: async (id: string, digest: string) =>
      StoredRunSchema.parse(await rpc('approve', { id, digest })),
    cancel: async (id: string) => StoredRunSchema.parse(await rpc('cancel', { id })),
  };
}
