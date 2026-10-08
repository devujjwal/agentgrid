import { CreatorUsernameSchema } from '../../src/domain/creator.ts';
import { documentSecurityHeaders } from '../../src/domain/document-security.ts';
import { creatorDocument } from '../community/creator-document.ts';
import type { publicCreatorData } from '../community/creators.ts';
import { assertRequestTarget } from './guard.ts';
export function creatorPageHandler(origin: string, read: ReturnType<typeof publicCreatorData>) {
  return async (request: Request): Promise<Response> => {
    const headers = new Headers({
      ...documentSecurityHeaders,
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'private, no-store',
      'cdn-cache-control': 'no-store',
      'x-robots-tag': 'noindex, follow',
      'content-security-policy':
        "default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
    });
    const result = (status: number, body: string) =>
      new Response(request.method === 'HEAD' ? null : body, { status, headers });
    try {
      assertRequestTarget(request, origin);
      if (!['GET', 'HEAD'].includes(request.method)) {
        headers.set('allow', 'GET, HEAD');
        return result(405, creatorDocument(null, 405));
      }
      const url = new URL(request.url),
        match = /^\/creators\/([a-z][a-z0-9_]{2,29})\/$/.exec(url.pathname);
      if (
        !match ||
        !CreatorUsernameSchema.safeParse(match[1]).success ||
        [...url.searchParams.keys()].some((key) => key !== 'offset') ||
        url.searchParams.getAll('offset').length > 1
      )
        return result(404, creatorDocument(null, 404));
      const raw = url.searchParams.get('offset') ?? '0';
      if (!/^(0|[1-9]\d{0,3})$/.test(raw) || Number(raw) > 9980 || Number(raw) % 20 !== 0)
        return result(404, creatorDocument(null, 404));
      const creator = await read(match[1]!, Number(raw));
      if (!creator || (Number(raw) > 0 && !creator.agents.length))
        return result(404, creatorDocument(null, 404));
      return result(200, creatorDocument(creator, 200));
    } catch {
      headers.set('retry-after', '60');
      return result(503, creatorDocument(null, 503));
    }
  };
}
