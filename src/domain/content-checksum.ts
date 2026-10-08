import { assertJsonDocumentBounds } from './agent-specification.ts';
/** AgentGrid canonical-json-v1: sorted UTF-16 keys, JSON.stringify primitives, no whitespace. */
export function canonicalJson(value: unknown): string {
  assertJsonDocumentBounds(value);
  function encode(item: unknown): string {
    if (Array.isArray(item)) return `[${Array.from(item, encode).join(',')}]`;
    if (item !== null && typeof item === 'object')
      return `{${Object.keys(item)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${encode((item as Record<string, unknown>)[key])}`)
        .join(',')}}`;
    const encoded = JSON.stringify(item);
    if (encoded === undefined || (typeof item === 'number' && !Number.isFinite(item)))
      throw new Error('Canonical document must contain finite JSON values only.');
    return encoded;
  }
  return encode(value);
}

export async function contentChecksum(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const hashed = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hashed), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
