/** Server-only HMAC pseudonyms: never persist raw emails/IP addresses in quotas. */
const encoder = new TextEncoder();
const scopes = ['ip', 'email', 'identity', 'code', 'csrf', 'flow', 'binding', 'session'] as const;
type MacScope = (typeof scopes)[number];

export async function createPrivateMac(material: string, origin: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(material))
    throw new Error('AgentGrid private MAC is unavailable.');
  const raw = Uint8Array.from(atob(material.replaceAll('-', '+').replaceAll('_', '/')), (c) =>
    c.charCodeAt(0),
  );
  const canonical = btoa(String.fromCharCode(...raw))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
  const target = new URL(origin);
  if (
    raw.byteLength !== 32 ||
    canonical !== material ||
    target.origin !== origin ||
    (target.protocol !== 'https:' && origin !== 'http://localhost:3027')
  )
    throw new Error('AgentGrid private MAC is unavailable.');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
  const data = (scope: MacScope, value: string) => {
    if (!scopes.includes(scope) || typeof value !== 'string' || value.length > 8192)
      throw new Error('AgentGrid private MAC is unavailable.');
    return encoder.encode(JSON.stringify(['agentgrid', origin, scope, value]));
  };
  return {
    async digest(scope: MacScope, value: string): Promise<string> {
      const signature = await crypto.subtle.sign('HMAC', key, data(scope, value));
      return Array.from(new Uint8Array(signature), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
    },
    async verify(scope: MacScope, value: string, digest: string): Promise<boolean> {
      if (!/^[a-f0-9]{64}$/.test(digest)) return false;
      const bytes = Uint8Array.from(digest.match(/../g)!, (byte) => parseInt(byte, 16));
      return crypto.subtle.verify('HMAC', key, bytes, data(scope, value));
    },
  };
}
