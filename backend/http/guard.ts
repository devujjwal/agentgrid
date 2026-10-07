/** The Pages boundary never trusts forwarded hosts, client roles or redirect URLs. */
export type FailureCode =
  | 'request-refused'
  | 'method-unavailable'
  | 'request-too-large'
  | 'invalid-request'
  | 'definition-incomplete'
  | 'service-unavailable'
  | 'not-signed-in'
  | 'verification-unavailable'
  | 'rate-limited'
  | 'conflict'
  | 'terms-required'
  | 'not-found';
export class HttpFailure extends Error {
  readonly status: 400 | 401 | 403 | 404 | 405 | 409 | 413 | 429 | 503;
  readonly code: FailureCode;
  constructor(status: HttpFailure['status'], code: FailureCode) {
    super('AgentGrid request could not be completed.');
    this.status = status;
    this.code = code;
  }
}

export function assertRequestTarget(request: Request, origin: string): void {
  const target = new URL(request.url);
  const expected = new URL(origin);
  const host = request.headers.get('host');
  if (target.origin !== origin || (host && host.toLowerCase() !== expected.host))
    throw new HttpFailure(403, 'request-refused');
  if (request.url.length > 8192) throw new HttpFailure(413, 'request-too-large');
}

export function assertMutationOrigin(request: Request, origin: string): void {
  assertRequestTarget(request, origin);
  if (request.method !== 'POST') throw new HttpFailure(405, 'method-unavailable');
  if (
    request.headers.get('origin') !== origin ||
    (request.headers.has('sec-fetch-site') &&
      request.headers.get('sec-fetch-site') !== 'same-origin')
  )
    throw new HttpFailure(403, 'request-refused');
}

export async function readJsonBody(request: Request, maximumBytes = 16_000): Promise<unknown> {
  if (!Number.isInteger(maximumBytes) || maximumBytes < 1 || maximumBytes > 100_000)
    throw new HttpFailure(503, 'service-unavailable');
  if (
    request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json'
  )
    throw new HttpFailure(400, 'invalid-request');
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > maximumBytes))
    throw new HttpFailure(413, 'request-too-large');
  if (!request.body) throw new HttpFailure(400, 'invalid-request');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new HttpFailure(413, 'request-too-large');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof HttpFailure) throw error;
    throw new HttpFailure(400, 'invalid-request');
  } finally {
    reader.releaseLock();
  }
}

export function privateJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

/** Provider/database errors may contain secrets. Never serialize their bodies,
 * messages, stack traces, inputs or causes into an HTTP failure response.
 */
export function privateFailure(error: unknown): Response {
  return error instanceof HttpFailure
    ? privateJson({ error: error.code }, error.status)
    : privateJson({ error: 'service-unavailable' }, 503);
}
