import { z } from 'zod';
import { MediaAssetSchema, type MediaAsset } from './reel-contracts.ts';

export interface PrivateMediaBucket {
  put(
    key: string,
    bytes: Uint8Array,
    options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string> },
  ): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}
export interface VideoProbe {
  /** A trusted decoder must inspect bytes, not provider/client-declared metadata. */
  inspect(bytes: Uint8Array): Promise<{
    width: number;
    height: number;
    seconds: number;
    videoCodec: string;
    audioCodec: string | null;
  }>;
}
export async function persistPrivateVideo(options: {
  ownerId: string;
  runId: string;
  bytes: Uint8Array;
  bucket: PrivateMediaBucket;
  probe: VideoProbe;
}): Promise<MediaAsset> {
  z.uuid().parse(options.ownerId);
  z.uuid().parse(options.runId);
  if (
    options.bytes.byteLength < 12 ||
    options.bytes.byteLength > 50_000_000 ||
    new TextDecoder().decode(options.bytes.subarray(4, 8)) !== 'ftyp'
  )
    throw new Error('Unsupported video.');
  const decoded = await options.probe.inspect(options.bytes);
  if (
    decoded.videoCodec !== 'h264' ||
    (decoded.audioCodec !== null && decoded.audioCodec !== 'aac')
  )
    throw new Error('Unsupported video codecs.');
  const sha256 = Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', options.bytes as BufferSource)),
    (byte) => byte.toString(16).padStart(2, '0'),
  ).join('');
  const id = crypto.randomUUID();
  const asset = MediaAssetSchema.parse({
    id,
    ownerId: options.ownerId,
    runId: options.runId,
    key: `owners/${options.ownerId}/reels/${options.runId}/${id}.mp4`,
    sha256,
    bytes: options.bytes.byteLength,
    contentType: 'video/mp4',
    width: decoded.width,
    height: decoded.height,
    seconds: decoded.seconds,
  });
  await options.bucket.put(asset.key, options.bytes, {
    httpMetadata: { contentType: asset.contentType },
    customMetadata: { ownerId: asset.ownerId, runId: asset.runId, sha256: asset.sha256 },
  });
  return asset;
}

/** HTTP must first authenticate membership and resolve this asset from the private ledger.
 * This function creates no public URL and cannot retrieve a caller-supplied object key.
 */
export async function readPrivateVideo(
  ownerId: string,
  evidence: unknown,
  bucket: PrivateMediaBucket,
): Promise<Response> {
  const asset = MediaAssetSchema.parse(evidence);
  if (asset.ownerId !== ownerId) throw new Error('Media unavailable.');
  const object = await bucket.get(asset.key);
  if (!object) throw new Error('Media unavailable.');
  const bytes = await object.arrayBuffer();
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  if (bytes.byteLength !== asset.bytes || digest !== asset.sha256)
    throw new Error('Media unavailable.');
  return new Response(bytes, {
    headers: {
      'Content-Type': 'video/mp4',
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment; filename="agentgrid-reel.mp4"',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
