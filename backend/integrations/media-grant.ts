import { z } from 'zod';
import { MediaAssetSchema } from '../execution/reel-contracts.ts';
import { requireEnabled } from './http.ts';
const GrantSchema = z.strictObject({
  subject: z.uuid(),
  connectionId: z.uuid(),
  asset: MediaAssetSchema,
  expiresAt: z.number().int().positive(),
});
const additionalData = new TextEncoder().encode('agentgrid-provider-media-v1');
function hex(bytes: Uint8Array) {
  return Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
}
async function key(value: Uint8Array) {
  if (value.length !== 32) throw new Error('Media grant unavailable.');
  return crypto.subtle.importKey('raw', value as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
/** Issued only by a claimed, owner-approved delivery; never accepts a browser object key. */
export async function issueMediaGrant(options: {
  enabled: () => boolean;
  key: Uint8Array;
  subject: string;
  connectionId: string;
  asset: unknown;
  now: Date;
  seconds: number;
}) {
  requireEnabled(options.enabled);
  z.number().int().min(1).max(900).parse(options.seconds);
  const payload = GrantSchema.parse({
    subject: options.subject,
    connectionId: options.connectionId,
    asset: options.asset,
    expiresAt: Math.floor(options.now.getTime() / 1000) + options.seconds,
  });
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData },
    await key(options.key),
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return `v1.${hex(iv)}.${hex(new Uint8Array(sealed))}`;
}
export async function openMediaGrant(secret: Uint8Array, token: string, now: Date) {
  try {
    if (token.length > 10_000 || !/^v1\.[a-f0-9]{24}\.[a-f0-9]+$/.test(token)) throw new Error();
    const [, nonce, cipher] = token.split('.');
    const unhex = (value: string) => Uint8Array.from(value.match(/../g)!, (v) => parseInt(v, 16));
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unhex(nonce!), additionalData },
      await key(secret),
      unhex(cipher!) as BufferSource,
    );
    const value = GrantSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    const time = Math.floor(now.getTime() / 1000);
    if (!Number.isFinite(time) || value.expiresAt <= time || value.expiresAt > time + 900)
      throw new Error();
    return value;
  } catch {
    throw new Error('Media grant unavailable.');
  }
}
export function integrationKey(environment: Record<string, unknown>, name: string) {
  const encoded = z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(environment[name]);
  return Uint8Array.from(encoded.match(/../g)!, (v) => parseInt(v, 16));
}
