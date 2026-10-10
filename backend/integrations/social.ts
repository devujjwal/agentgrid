import { z } from 'zod';
import {
  MediaAssetSchema,
  type MediaAsset,
  type SocialPublisher,
} from '../execution/reel-contracts.ts';
import { providerFetch } from '../http/provider-fetch.ts';
import { approvedUrl, providerJson, requireEnabled, sha256 } from './http.ts';

export const ConnectionSecretSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  platform: z.enum(['instagram', 'facebook', 'linkedin']),
  accountId: z.string().min(1).max(300),
  accessToken: z.string().min(1).max(8000),
  expiresAt: z.iso.datetime(),
  publishingEnabled: z.literal(true),
  scopes: z.array(z.string()).max(30),
});
export type ConnectionSecret = z.infer<typeof ConnectionSecretSchema>;
export interface DeliveryReceipts {
  /** Atomic insert before any outbound mutation. False means do not retry. */
  begin(
    deliveryId: string,
    binding: { connectionId: string; mediaId: string; sha256: string; caption: string },
  ): Promise<boolean>;
  pending(
    deliveryId: string,
    connectionId: string,
    mediaId: string,
    checksum: string,
    caption: string,
  ): Promise<{ mediaId: string } | null>;
  save(deliveryId: string, stage: string, providerId: string): Promise<void>;
  /** Find only a completed receipt bound to this exact owner-scoped connection and asset. */
  published(
    connectionId: string,
    postId: string,
    mediaId: string,
    checksum: string,
    caption: string,
  ): Promise<{ mediaId: string } | null>;
}
interface Options {
  enabled: () => boolean;
  transport: typeof fetch;
  now: () => Date;
  connection: (id: string) => Promise<unknown>;
  receipts: DeliveryReceipts;
  bytes: (asset: MediaAsset) => Promise<Uint8Array>;
  /** Server-issued short-lived, checksum-bound fetch grant; no user supplied URLs. */
  mediaUrl: (asset: MediaAsset, connectionId: string) => Promise<string>;
  mediaHosts: readonly string[];
  metaVersion: string;
}
const numericId = z.string().regex(/^[0-9]{1,80}$/);
const videoUrn = z.string().regex(/^urn:li:video:[A-Za-z0-9_-]{1,160}$/);
const postUrn = z.string().regex(/^urn:li:(?:share|ugcPost):[A-Za-z0-9_-]{1,160}$/);
export function socialPublisher(
  platform: SocialPublisher['platform'],
  options: Options,
): SocialPublisher {
  if (platform !== 'linkedin' && !/^v[0-9]{1,2}\.0$/.test(options.metaVersion))
    throw new Error('Reviewed Meta API version required.');
  async function connection(id: string, asset: Pick<MediaAsset, 'ownerId'>) {
    requireEnabled(options.enabled);
    const value = ConnectionSecretSchema.parse(await options.connection(id));
    if (
      value.id !== id ||
      value.platform !== platform ||
      value.ownerId !== asset.ownerId ||
      Date.parse(value.expiresAt) <= options.now().getTime()
    )
      throw new Error('Connection unavailable.');
    if (platform === 'linkedin') {
      if (
        !/^urn:li:person:[A-Za-z0-9_-]{1,160}$/.test(value.accountId) ||
        !['w_member_social', 'r_member_social'].every((s) => value.scopes.includes(s))
      )
        throw new Error('LinkedIn publication/readback permissions required.');
    } else {
      numericId.parse(value.accountId);
      const required =
        platform === 'instagram'
          ? ['instagram_basic', 'instagram_content_publish', 'pages_read_engagement']
          : ['pages_manage_posts', 'pages_read_engagement'];
      if (!required.every((scope) => value.scopes.includes(scope)))
        throw new Error('Meta publication/readback permissions required.');
    }
    return value;
  }
  async function api(c: ConnectionSecret, path: string, body?: unknown, signal?: AbortSignal) {
    requireEnabled(options.enabled);
    // Re-resolve revocation and expiry immediately before each provider request.
    const current = await connection(c.id, { ownerId: c.ownerId });
    if (
      current.ownerId !== c.ownerId ||
      current.platform !== c.platform ||
      current.accountId !== c.accountId ||
      Date.parse(current.expiresAt) <= options.now().getTime()
    )
      throw new Error('Connection unavailable.');
    c = current;
    const linkedin = platform === 'linkedin';
    return providerJson(
      options.transport,
      (linkedin
        ? 'https://api.linkedin.com/rest/'
        : `https://graph.facebook.com/${options.metaVersion}/`) + path,
      {
        method: body ? 'POST' : 'GET',
        headers: {
          Authorization: `Bearer ${c.accessToken}`,
          ...(linkedin
            ? {
                'Linkedin-Version': '202609',
                'X-Restli-Protocol-Version': '2.0.0',
                'Content-Type': 'application/json',
              }
            : { 'Content-Type': 'application/x-www-form-urlencoded' }),
        },
        ...(body
          ? {
              body: linkedin
                ? JSON.stringify(body)
                : new URLSearchParams(body as Record<string, string>).toString(),
            }
          : {}),
        ...(signal ? { signal } : {}),
      },
    );
  }
  return {
    platform,
    async publish(input) {
      requireEnabled(options.enabled);
      const asset = MediaAssetSchema.parse(input.asset);
      z.uuid().parse(input.deliveryId);
      z.uuid().parse(input.connectionId);
      if (
        !input.caption.trim() ||
        input.caption.length > (platform === 'instagram' ? 2200 : 3000) ||
        asset.seconds < 3
      )
        throw new Error('Unsupported publication.');
      const c = await connection(input.connectionId, asset);
      // Resolve media and validate checksum before claiming a non-retryable mutation.
      let bytes: Uint8Array | undefined;
      let mediaUrl: string | undefined;
      if (platform === 'instagram')
        mediaUrl = approvedUrl(await options.mediaUrl(asset, c.id), options.mediaHosts);
      else {
        bytes = await options.bytes(asset);
        if (bytes.byteLength !== asset.bytes || (await sha256(bytes)) !== asset.sha256)
          throw new Error('Media checksum mismatch.');
      }
      if (
        !(await options.receipts.begin(input.deliveryId, {
          connectionId: c.id,
          mediaId: asset.id,
          sha256: asset.sha256,
          caption: input.caption,
        }))
      )
        throw new Error('Delivery already attempted; reconcile instead.');
      if (platform === 'instagram') {
        const created = z.object({ id: numericId }).parse(
          (
            await api(
              c,
              `${c.accountId}/media`,
              {
                media_type: 'REELS',
                video_url: mediaUrl!,
                caption: input.caption,
                share_to_feed: 'true',
              },
              input.signal,
            )
          ).body,
        );
        await options.receipts.save(input.deliveryId, 'upload', created.id);
        const status = z
          .object({ id: z.literal(created.id), status_code: z.string() })
          .parse(
            (await api(c, `${created.id}?fields=id,status_code`, undefined, input.signal)).body,
          );
        if (status.status_code !== 'FINISHED')
          throw new Error('Upload awaits reconciliation; publication was not retried.');
        await options.receipts.save(input.deliveryId, 'publishing', created.id);
        const result = z
          .object({ id: numericId })
          .parse(
            (
              await api(
                c,
                `${c.accountId}/media_publish`,
                { creation_id: created.id },
                input.signal,
              )
            ).body,
          );
        await options.receipts.save(input.deliveryId, 'published', result.id);
        return { postId: result.id };
      }
      if (platform === 'facebook') {
        const created = z
          .object({ video_id: numericId, upload_url: z.string() })
          .parse(
            (await api(c, `${c.accountId}/video_reels`, { upload_phase: 'start' }, input.signal))
              .body,
          );
        await options.receipts.save(input.deliveryId, 'upload', created.video_id);
        const uploadUrl = approvedUrl(
          created.upload_url,
          ['rupload.facebook.com'],
          `/video-upload/${options.metaVersion}/${created.video_id}`,
        );
        if (
          new URL(uploadUrl).pathname !== `/video-upload/${options.metaVersion}/${created.video_id}`
        )
          throw new Error('Unexpected upload destination.');
        await connection(c.id, asset);
        requireEnabled(options.enabled);
        const uploaded = await providerJson(options.transport, uploadUrl, {
          method: 'POST',
          headers: {
            Authorization: `OAuth ${c.accessToken}`,
            offset: '0',
            file_size: String(bytes!.length),
            'Content-Type': 'application/octet-stream',
          },
          body: bytes as BodyInit,
          signal: input.signal,
        });
        z.object({ success: z.literal(true) }).parse(uploaded.body);
        await options.receipts.save(input.deliveryId, 'publishing', created.video_id);
        z.object({ success: z.literal(true) }).parse(
          (
            await api(
              c,
              `${c.accountId}/video_reels`,
              {
                upload_phase: 'finish',
                video_id: created.video_id,
                video_state: 'PUBLISHED',
                description: input.caption,
              },
              input.signal,
            )
          ).body,
        );
        await options.receipts.save(input.deliveryId, 'published', created.video_id);
        return { postId: created.video_id };
      }
      const created = z
        .object({
          value: z.object({
            video: videoUrn,
            uploadToken: z.string().max(8000),
            uploadUrlsExpireAt: z.number(),
            uploadInstructions: z
              .array(
                z.object({
                  firstByte: z.number().int().nonnegative(),
                  lastByte: z.number().int().nonnegative(),
                  uploadUrl: z.string(),
                }),
              )
              .min(1)
              .max(20),
          }),
        })
        .parse(
          (
            await api(
              c,
              'videos?action=initializeUpload',
              {
                initializeUploadRequest: {
                  owner: c.accountId,
                  fileSizeBytes: asset.bytes,
                  uploadCaptions: false,
                  uploadThumbnail: false,
                },
              },
              input.signal,
            )
          ).body,
        ).value;
      await options.receipts.save(input.deliveryId, 'upload', created.video);
      if (created.uploadUrlsExpireAt <= options.now().getTime()) throw new Error('Upload expired.');
      const parts: string[] = [];
      let offset = 0;
      for (const part of created.uploadInstructions) {
        if (part.firstByte !== offset || part.lastByte < offset || part.lastByte >= bytes!.length)
          throw new Error('Invalid upload ranges.');
        offset = part.lastByte + 1;
        const url = approvedUrl(part.uploadUrl, ['www.linkedin.com'], '/dms-uploads/');
        await connection(c.id, asset);
        requireEnabled(options.enabled);
        const response = await providerFetch(options.transport, url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: bytes!.slice(part.firstByte, offset) as BodyInit,
          signal: AbortSignal.any([input.signal, AbortSignal.timeout(30_000)]),
        });
        const etag = response.headers.get('etag');
        await response.body?.cancel();
        if (!response.ok || !etag || etag.length > 8000)
          throw new Error('Upload receipt unavailable.');
        parts.push(etag);
      }
      if (offset !== bytes!.length) throw new Error('Incomplete upload ranges.');
      await api(
        c,
        'videos?action=finalizeUpload',
        {
          finalizeUploadRequest: {
            video: created.video,
            uploadToken: created.uploadToken,
            uploadedPartIds: parts,
          },
        },
        input.signal,
      );
      const status = z
        .object({ id: z.literal(created.video), owner: z.literal(c.accountId), status: z.string() })
        .parse(
          (await api(c, `videos/${encodeURIComponent(created.video)}`, undefined, input.signal))
            .body,
        );
      if (status.status !== 'AVAILABLE')
        throw new Error('Video awaits reconciliation; publication was not retried.');
      await options.receipts.save(input.deliveryId, 'publishing', created.video);
      const posted = await api(
        c,
        'posts',
        {
          author: c.accountId,
          commentary: input.caption,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: { media: { id: created.video } },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        },
        input.signal,
      );
      const postId = postUrn.parse(posted.headers.get('x-restli-id'));
      await options.receipts.save(input.deliveryId, 'published', postId);
      return { postId };
    },
    async resume(input) {
      requireEnabled(options.enabled);
      const asset = MediaAssetSchema.parse(input.asset);
      const c = await connection(input.connectionId, asset);
      const receipt = await options.receipts.pending(
        input.deliveryId,
        c.id,
        asset.id,
        asset.sha256,
        input.caption,
      );
      if (!receipt) throw new Error('No resumable upload; reconcile instead.');
      if (platform === 'instagram') {
        numericId.parse(receipt.mediaId);
        const status = z
          .object({ id: z.literal(receipt.mediaId), status_code: z.string() })
          .parse(
            (await api(c, `${receipt.mediaId}?fields=id,status_code`, undefined, input.signal))
              .body,
          );
        if (status.status_code !== 'FINISHED') throw new Error('Upload not ready.');
        await options.receipts.save(input.deliveryId, 'publishing', receipt.mediaId);
        const result = z
          .object({ id: numericId })
          .parse(
            (
              await api(
                c,
                `${c.accountId}/media_publish`,
                { creation_id: receipt.mediaId },
                input.signal,
              )
            ).body,
          );
        await options.receipts.save(input.deliveryId, 'published', result.id);
        return { postId: result.id };
      }
      if (platform === 'facebook') {
        numericId.parse(receipt.mediaId);
        const status = z
          .object({
            id: z.literal(receipt.mediaId),
            status: z.object({
              uploading_phase: z.object({ status: z.literal('complete') }),
              publishing_phase: z.object({ status: z.literal('not_started') }),
            }),
          })
          .parse(
            (await api(c, `${receipt.mediaId}?fields=id,status`, undefined, input.signal)).body,
          );
        if (status.id !== receipt.mediaId) throw new Error('Upload not ready.');
        await options.receipts.save(input.deliveryId, 'publishing', receipt.mediaId);
        z.object({ success: z.literal(true) }).parse(
          (
            await api(
              c,
              `${c.accountId}/video_reels`,
              {
                upload_phase: 'finish',
                video_id: receipt.mediaId,
                video_state: 'PUBLISHED',
                description: input.caption,
              },
              input.signal,
            )
          ).body,
        );
        await options.receipts.save(input.deliveryId, 'published', receipt.mediaId);
        return { postId: receipt.mediaId };
      }
      videoUrn.parse(receipt.mediaId);
      const status = z
        .object({
          id: z.literal(receipt.mediaId),
          owner: z.literal(c.accountId),
          status: z.literal('AVAILABLE'),
        })
        .parse(
          (await api(c, `videos/${encodeURIComponent(receipt.mediaId)}`, undefined, input.signal))
            .body,
        );
      if (status.id !== receipt.mediaId) throw new Error('Upload not ready.');
      await options.receipts.save(input.deliveryId, 'publishing', receipt.mediaId);
      const result = await api(
        c,
        'posts',
        {
          author: c.accountId,
          commentary: input.caption,
          visibility: 'PUBLIC',
          distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
          },
          content: { media: { id: receipt.mediaId } },
          lifecycleState: 'PUBLISHED',
          isReshareDisabledByAuthor: false,
        },
        input.signal,
      );
      const postId = postUrn.parse(result.headers.get('x-restli-id'));
      await options.receipts.save(input.deliveryId, 'published', postId);
      return { postId };
    },
    async verify(input) {
      requireEnabled(options.enabled);
      const asset = MediaAssetSchema.parse(input.asset);
      const c = await connection(input.connectionId, asset);
      const receipt = await options.receipts.published(
        c.id,
        input.postId,
        asset.id,
        asset.sha256,
        input.caption,
      );
      if (!receipt) return false;
      if (platform === 'linkedin') {
        postUrn.parse(input.postId);
        const result = z
          .object({
            id: z.string(),
            author: z.string(),
            commentary: z.string(),
            lifecycleState: z.string(),
            visibility: z.string(),
            content: z.object({ media: z.object({ id: z.string() }) }),
          })
          .parse(
            (await api(c, `posts/${encodeURIComponent(input.postId)}`, undefined, input.signal))
              .body,
          );
        return (
          result.id === input.postId &&
          result.author === c.accountId &&
          result.commentary === input.caption &&
          result.lifecycleState === 'PUBLISHED' &&
          result.visibility === 'PUBLIC' &&
          result.content.media.id === receipt.mediaId
        );
      }
      numericId.parse(input.postId);
      // Owner-scoped edge proves destination; absence, pagination or delayed processing stays uncertain.
      const edge =
        platform === 'instagram'
          ? 'media?fields=id,caption,media_product_type&limit=100'
          : 'videos?fields=id,description,published&limit=100';
      const result = z
        .object({
          data: z
            .array(
              z.object({
                id: numericId,
                caption: z.string().optional(),
                description: z.string().optional(),
                media_product_type: z.string().optional(),
                published: z.boolean().optional(),
              }),
            )
            .max(100),
        })
        .parse((await api(c, `${c.accountId}/${edge}`, undefined, input.signal)).body);
      return result.data.some(
        (item) =>
          item.id === input.postId &&
          (platform === 'instagram'
            ? item.caption === input.caption && item.media_product_type === 'REELS'
            : item.description === input.caption && item.published === true),
      );
    },
  };
}
