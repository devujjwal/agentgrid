import { z } from 'zod';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { openSocialTokens } from '../execution/social-secrets.ts';
import { providerJson } from './http.ts';
import { ConnectionSecretSchema, type DeliveryReceipts } from './social.ts';
import type { OAuthStore } from './oauth.ts';
const FlowSchema = z.strictObject({
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  ownerId: z.uuid(),
  sessionDigest: z.string().regex(/^[a-f0-9]{64}$/),
  platform: z.enum(['instagram', 'facebook', 'linkedin']),
  redirectUri: z.url(),
  expiresAt: z.iso.datetime({ offset: true }),
});
/** Construct only with a verified auth subject. Never expose this port to a browser. */
export function integrationStore(
  environment: Record<string, unknown>,
  subject: string,
  key: Uint8Array,
  now: () => Date,
  transport: typeof fetch = fetch,
) {
  z.uuid().parse(subject);
  const configuration = publicCommunityConfiguration(environment);
  const secret = z
    .string()
    .regex(/^sb_secret_[A-Za-z0-9_-]{20,}$/)
    .parse(environment.SUPABASE_SECRET_KEY);
  async function rpc(operation: string, evidence: unknown) {
    return (
      await providerJson(
        transport,
        configuration.supabaseOrigin + '/rest/v1/rpc/agentgrid_server_integrations',
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
      )
    ).body;
  }
  const oauth: OAuthStore = {
    async create(state) {
      await rpc('create-flow', FlowSchema.parse(state));
    },
    async consume(digest, ownerId, sessionDigest, platform) {
      const value = FlowSchema.nullable().parse(
        await rpc('consume-flow', { digest, sessionDigest, platform }),
      );
      if (value && value.ownerId !== ownerId) throw new Error('OAuth owner mismatch.');
      return value;
    },
    async connect(value) {
      await rpc('connect', value);
    },
  };
  const receipts: DeliveryReceipts = {
    async begin(deliveryId, binding) {
      return z.boolean().parse(await rpc('begin', { deliveryId, ...binding }));
    },
    async pending(deliveryId, connectionId, mediaId, checksum, caption) {
      return z
        .strictObject({ mediaId: z.string().min(1).max(300) })
        .nullable()
        .parse(await rpc('pending', { deliveryId, connectionId, mediaId, checksum, caption }));
    },
    async save(deliveryId, stage, providerId) {
      await rpc('save', { deliveryId, stage, providerId });
    },
    async published(connectionId, postId, mediaId, checksum, caption) {
      return z
        .strictObject({ mediaId: z.string().min(1).max(300) })
        .nullable()
        .parse(await rpc('published', { connectionId, postId, mediaId, checksum, caption }));
    },
  };
  async function connection(id: string) {
    const stored = z
      .strictObject({
        id: z.uuid(),
        ownerId: z.uuid(),
        platform: z.enum(['instagram', 'facebook', 'linkedin']),
        accountId: z.string(),
        expiresAt: z.iso.datetime({ offset: true }),
        publishingEnabled: z.literal(true),
        scopes: z.array(z.string()).max(30),
        sealedTokens: z.string().max(100_000),
      })
      .parse(await rpc('connection', { connectionId: id }));
    if (stored.id !== id) throw new Error('Connection unavailable.');
    const tokens = await openSocialTokens(
      key,
      { ownerId: stored.ownerId, connectionId: stored.id, platform: stored.platform },
      stored.sealedTokens,
      now(),
    );
    if (Date.parse(tokens.expiresAt) !== Date.parse(stored.expiresAt))
      throw new Error('Connection expiry mismatch.');
    return ConnectionSecretSchema.parse({
      id: stored.id,
      ownerId: stored.ownerId,
      platform: stored.platform,
      accountId: stored.accountId,
      publishingEnabled: true,
      scopes: stored.scopes,
      accessToken: tokens.accessToken,
      expiresAt: tokens.expiresAt,
    });
  }
  async function recover(deliveryId: string, connectionId: string) {
    return z
      .string()
      .min(1)
      .max(300)
      .nullable()
      .parse(await rpc('recover', { deliveryId, connectionId }));
  }
  return { oauth, receipts, connection, recover };
}
