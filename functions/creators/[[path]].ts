import { publicCommunityConfiguration } from '../../backend/community/configuration.ts';
import { publicCreatorData } from '../../backend/community/creators.ts';
import { creatorPageHandler } from '../../backend/http/creators.ts';
import { creatorDocument } from '../../backend/community/creator-document.ts';
export async function onRequest(context: { request: Request; env: Record<string, unknown> }) {
  try {
    const configuration = publicCommunityConfiguration(context.env);
    return creatorPageHandler(
      configuration.origin,
      publicCreatorData(configuration),
    )(context.request);
  } catch {
    return new Response(context.request.method === 'HEAD' ? null : creatorDocument(null, 503), {
      status: 503,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
        'content-security-policy':
          "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'",
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
      },
    });
  }
}
