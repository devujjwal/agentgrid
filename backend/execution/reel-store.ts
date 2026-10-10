import { z } from 'zod';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { PublicationPreviewSchema, publicationPreviewDigest } from './publication-approval.ts';
import {
  MediaAssetSchema,
  ReelPlanSchema,
  type ReelStore,
  type DeliveryStore,
  type ReelRecord,
} from './reel-contracts.ts';

const ReelRecordSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  idempotencyKey: z.uuid(),
  plan: ReelPlanSchema,
  providerIdentity: z.string().min(1).max(120),
  maximumCostMicros: z.int().min(1).max(5_000_000),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(['queued', 'rendering', 'ready', 'cancelled', 'uncertain', 'blocked']),
  taskId: z.string().min(1).max(200).nullable(),
  asset: MediaAssetSchema.nullable(),
});
const DeliveryRecordSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  preview: PublicationPreviewSchema,
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  connectionId: z.uuid(),
  state: z.enum(['pending', 'dispatching', 'published', 'uncertain', 'cancelled']),
  providerPostId: z.string().min(1).max(300).nullable(),
});
const ContextSchema = z.strictObject({
  asset: MediaAssetSchema.nullable(),
  approval: z
    .strictObject({
      ownerId: z.uuid(),
      digest: z.string().regex(/^[a-f0-9]{64}$/),
      expiresAt: z.iso.datetime({ offset: true }),
    })
    .nullable(),
  connections: z
    .array(
      z.strictObject({
        id: z.uuid(),
        ownerId: z.uuid(),
        platform: z.enum(['instagram', 'facebook', 'linkedin']),
        publishingEnabled: z.boolean(),
      }),
    )
    .max(3),
});

/** Only a verified session/worker subject may construct this server adapter.
 * It never returns sealed tokens or provider account identifiers to its caller.
 */
export function reelStore(
  environment: Record<string, unknown>,
  subject: string,
  transport: typeof fetch = fetch,
) {
  z.uuid().parse(subject);
  const configuration = publicCommunityConfiguration(environment);
  const key = environment.SUPABASE_SECRET_KEY;
  if (typeof key !== 'string' || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))
    throw new Error('Media storage unavailable.');
  async function rpc(operation: string, evidence: unknown = {}): Promise<unknown> {
    const response = await providerFetch(
      transport,
      configuration.supabaseOrigin + '/rest/v1/rpc/agentgrid_server_media',
      {
        method: 'POST',
        headers: {
          apikey: key as string,
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ actor_user_id: subject, operation, evidence }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error('Media storage unavailable.');
    }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 500_000) {
          await reader.cancel();
          throw new Error('Media response exceeds bounds.');
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
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  }
  const reels: ReelStore = {
    prepare: async (record: ReelRecord) =>
      ReelRecordSchema.parse(await rpc('prepare', ReelRecordSchema.parse(record))),
    read: async (_owner, id) => ReelRecordSchema.nullable().parse(await rpc('read', { id })),
    claim: async (_owner, id, digest) => z.boolean().parse(await rpc('claim', { id, digest })),
    task: async (_owner, id, taskId) => {
      await rpc('task', { id, taskId });
    },
    finish: async (_owner, id, asset, billedMicros) => {
      await rpc('finish', {
        id,
        asset: asset === null ? null : MediaAssetSchema.parse(asset),
        billedMicros,
      });
    },
  };
  const deliveries: DeliveryStore = {
    read: async (_owner, id) =>
      DeliveryRecordSchema.nullable().parse(await rpc('read-delivery', { id })),
    context: async (_owner, id) => ContextSchema.parse(await rpc('context', { id })),
    claim: async (_owner, id, digest) =>
      z.boolean().parse(await rpc('claim-delivery', { id, digest })),
    submitted: async (_owner, id, postId) => {
      await rpc('submitted-delivery', { id, postId });
    },
    finish: async (_owner, id, postId) => {
      await rpc('finish-delivery', { id, postId });
    },
  };
  return {
    reels,
    deliveries,
    approveReel: async (id: string, digest: string) => {
      await rpc('approve', { id, digest });
    },
    cancelReel: async (id: string) => {
      await rpc('cancel', { id });
    },
    preparePublication: async (preview: unknown) => {
      const parsed = PublicationPreviewSchema.parse(preview);
      return z.uuid().parse(
        await rpc('publication', {
          id: crypto.randomUUID(),
          preview: parsed,
          digest: await publicationPreviewDigest(parsed),
        }),
      );
    },
    approvePublication: async (id: string, digest: string) => {
      await rpc('approve-publication', { id, digest });
    },
    disconnect: async (id: string) => {
      await rpc('disconnect', { id });
    },
  };
}
