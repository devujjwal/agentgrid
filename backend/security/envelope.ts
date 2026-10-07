/** Web-standard AEAD for server-only flow cookies and encrypted provider state.
 * It is not an identity proof: callers must validate payload schemas, session
 * records and managed identity before granting application access.
 */
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const limits = {
  csrf: { seconds: 3600, bytes: 2400 },
  oauth: { seconds: 600, bytes: 2400 },
  challenge: { seconds: 300, bytes: 2400 },
  session: { seconds: 2_592_000, bytes: 2400 },
  'provider-session': { seconds: 2_592_000, bytes: 24_000 },
} as const;
export type EnvelopePurpose = keyof typeof limits;
type Primitive = string | number | boolean | null;
export type EnvelopeValue = Record<string, Primitive>;
export interface EnvelopeKey {
  id: string;
  material: string;
}
export class EnvelopeError extends Error {
  constructor() {
    super('AgentGrid private envelope is unavailable.');
  }
}

function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new EnvelopeError();
  const bytes = Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
  if (encode(bytes) !== value) throw new EnvelopeError();
  return bytes;
}
function validValue(value: unknown): value is EnvelopeValue {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return false;
  const entries = Object.entries(value);
  return (
    entries.length <= 40 &&
    entries.every(
      ([name, item]) =>
        /^[a-zA-Z][a-zA-Z0-9_]{0,63}$/.test(name) &&
        !['constructor', 'prototype', '__proto__'].includes(name) &&
        (item === null ||
          typeof item === 'string' ||
          typeof item === 'boolean' ||
          (typeof item === 'number' && Number.isFinite(item))),
    )
  );
}

export async function createEnvelopeCodec(keys: readonly EnvelopeKey[], origin: string) {
  const parsedOrigin = new URL(origin);
  if (
    parsedOrigin.origin !== origin ||
    (parsedOrigin.protocol !== 'https:' &&
      !(parsedOrigin.protocol === 'http:' && parsedOrigin.hostname === 'localhost')) ||
    keys.length < 1 ||
    keys.length > 2 ||
    new Set(keys.map((key) => key.id)).size !== keys.length
  )
    throw new EnvelopeError();
  const imported = await Promise.all(
    keys.map(async (key) => {
      if (!/^[a-z0-9_-]{1,16}$/.test(key.id) || key.material.length !== 43)
        throw new EnvelopeError();
      const raw = decode(key.material);
      if (raw.byteLength !== 32) throw new EnvelopeError();
      return {
        id: key.id,
        key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']),
      };
    }),
  );
  const active = imported[0]!;
  const aad = (purpose: EnvelopePurpose) => encoder.encode(`agentgrid|${origin}|${purpose}|1`);
  return {
    async seal(
      purpose: EnvelopePurpose,
      value: EnvelopeValue,
      lifetimeSeconds: number,
      now = Math.floor(Date.now() / 1000),
    ) {
      const policy = limits[purpose];
      if (
        !validValue(value) ||
        !Number.isSafeInteger(now) ||
        now < 0 ||
        !Number.isInteger(lifetimeSeconds) ||
        lifetimeSeconds < 1 ||
        lifetimeSeconds > policy.seconds
      )
        throw new EnvelopeError();
      const bytes = encoder.encode(
        JSON.stringify({ issued_at: now, expires_at: now + lifetimeSeconds, value }),
      );
      if (bytes.byteLength > policy.bytes) throw new EnvelopeError();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad(purpose), tagLength: 128 },
        active.key,
        bytes,
      );
      return `${active.id}.${encode(iv)}.${encode(new Uint8Array(ciphertext))}`;
    },
    async open(
      purpose: EnvelopePurpose,
      token: string,
      now = Math.floor(Date.now() / 1000),
    ): Promise<EnvelopeValue | null> {
      try {
        const policy = limits[purpose];
        if (
          !Number.isSafeInteger(now) ||
          now < 0 ||
          token.length > Math.ceil((policy.bytes * 4) / 3) + 80
        )
          return null;
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [id, ivText, cipherText] = parts;
        const selected = imported.find((key) => key.id === id);
        if (!selected || !ivText || !cipherText) return null;
        const iv = decode(ivText);
        const ciphertext = decode(cipherText);
        if (
          iv.byteLength !== 12 ||
          ciphertext.byteLength < 16 ||
          ciphertext.byteLength > policy.bytes + 16
        )
          return null;
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv, additionalData: aad(purpose), tagLength: 128 },
          selected.key,
          ciphertext,
        );
        const envelope = JSON.parse(decoder.decode(plaintext)) as Record<string, unknown>;
        if (
          !envelope ||
          Object.keys(envelope).sort().join(',') !== 'expires_at,issued_at,value' ||
          typeof envelope.issued_at !== 'number' ||
          typeof envelope.expires_at !== 'number' ||
          !Number.isSafeInteger(envelope.issued_at) ||
          !Number.isSafeInteger(envelope.expires_at) ||
          envelope.issued_at > now + 10 ||
          envelope.expires_at <= now ||
          envelope.expires_at <= envelope.issued_at ||
          envelope.expires_at - envelope.issued_at > policy.seconds ||
          !validValue(envelope.value)
        )
          return null;
        return envelope.value;
      } catch {
        return null;
      }
    },
  };
}
