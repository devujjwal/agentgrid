import { z } from 'zod';

const ContextSchema = z.strictObject({
  ownerId: z.uuid(),
  connectionId: z.uuid(),
  platform: z.enum(['instagram', 'facebook', 'linkedin']),
});
const TokenSchema = z.strictObject({
  accessToken: z.string().min(1).max(8000),
  refreshToken: z.string().min(1).max(8000).nullable(),
  expiresAt: z.iso.datetime(),
});
type Context = z.infer<typeof ContextSchema>;
function aad(context: Context) {
  return new TextEncoder().encode(JSON.stringify(ContextSchema.parse(context)));
}
function hex(bytes: Uint8Array) {
  return Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
}
function unhex(value: string) {
  if (!/^(?:[a-f0-9]{2})+$/.test(value)) throw new Error('Connection secret unavailable.');
  return Uint8Array.from(value.match(/../g)!, (part) => parseInt(part, 16));
}
async function importKey(key: Uint8Array) {
  if (key.byteLength !== 32) throw new Error('Connection secret unavailable.');
  return crypto.subtle.importKey('raw', key as BufferSource, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}
/** Server-only authenticated encryption; swapping owner/account/platform fails decryption.
 * The key belongs in a dedicated Worker secret, never Supabase or browser configuration.
 */
export async function sealSocialTokens(
  key: Uint8Array,
  context: Context,
  tokens: unknown,
): Promise<string> {
  const parsed = TokenSchema.parse(tokens);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad(context) },
    await importKey(key),
    new TextEncoder().encode(JSON.stringify(parsed)),
  );
  return `v1.${hex(iv)}.${hex(new Uint8Array(ciphertext))}`;
}
export async function openSocialTokens(
  key: Uint8Array,
  context: Context,
  sealed: string,
  now: Date,
) {
  try {
    if (sealed.length > 100_000 || !Number.isFinite(now.getTime())) throw new Error();
    const [version, nonce, ciphertext, extra] = sealed.split('.');
    if (version !== 'v1' || !nonce || nonce.length !== 24 || !ciphertext || extra !== undefined)
      throw new Error();
    const bytes = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unhex(nonce), additionalData: aad(context) },
      await importKey(key),
      unhex(ciphertext) as BufferSource,
    );
    const tokens = TokenSchema.parse(
      JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
    );
    if (Date.parse(tokens.expiresAt) <= now.getTime()) throw new Error();
    return tokens;
  } catch {
    throw new Error('Connection secret unavailable.');
  }
}
