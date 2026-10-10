import { providerFetch } from '../http/provider-fetch.ts';

/** No redirects, unbounded bodies, credential-bearing URLs or automatic retries. */
export async function boundedBytes(response: Response, maximum: number): Promise<Uint8Array> {
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error('Provider request failed.');
  }
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maximum) throw new Error('Provider response too large.');
      chunks.push(part.value);
    }
  } catch {
    await reader.cancel();
    throw new Error('Provider response unavailable.');
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
export async function providerJson(transport: typeof fetch, url: string, init: RequestInit) {
  try {
    const response = await providerFetch(transport, url, {
      ...init,
      signal: AbortSignal.any([
        init.signal ?? new AbortController().signal,
        AbortSignal.timeout(30_000),
      ]),
    });
    const bytes = await boundedBytes(response, 500_000);
    return {
      body: bytes.length
        ? (JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown)
        : null,
      headers: response.headers,
    };
  } catch {
    throw new Error('Provider request unavailable.');
  }
}
export function approvedUrl(value: string, hosts: readonly string[], prefix = '/') {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !hosts.includes(url.hostname) ||
    !url.pathname.startsWith(prefix)
  )
    throw new Error('Provider URL refused.');
  return url.href;
}
export function requireEnabled(enabled: () => boolean) {
  if (!enabled()) throw new Error('Integration execution is disabled.');
}
export async function sha256(bytes: Uint8Array) {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)),
    (n) => n.toString(16).padStart(2, '0'),
  ).join('');
}
