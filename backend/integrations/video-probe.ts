import { z } from 'zod';
import type { VideoProbe } from '../execution/media.ts';
import { approvedUrl, providerJson, requireEnabled } from './http.ts';
/** The configured sidecar decodes actual MP4 bytes with ffprobe in a private container. */
export function remoteVideoProbe(options: {
  enabled: () => boolean;
  origin: string;
  allowedHosts: readonly string[];
  key: () => Promise<string>;
  transport: typeof fetch;
}): VideoProbe {
  const url = approvedUrl(options.origin + '/inspect', options.allowedHosts);
  if (new URL(url).pathname !== '/inspect') throw new Error('Decoder origin refused.');
  return {
    async inspect(bytes) {
      requireEnabled(options.enabled);
      if (bytes.byteLength < 12 || bytes.byteLength > 50_000_000)
        throw new Error('Unsupported video.');
      const key = await options.key();
      if (key.length < 32 || key.length > 8000) throw new Error('Decoder unavailable.');
      const result = await providerJson(options.transport, url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'video/mp4' },
        body: bytes as BodyInit,
        signal: AbortSignal.timeout(25_000),
      });
      return z
        .strictObject({
          width: z.number().int().positive(),
          height: z.number().int().positive(),
          seconds: z.number().positive().finite(),
          videoCodec: z.string().min(1).max(30),
          audioCodec: z.string().min(1).max(30).nullable(),
        })
        .parse(result.body);
    },
  };
}
