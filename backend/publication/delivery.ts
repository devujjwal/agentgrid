/** Guard static detail documents, including Next RSC payloads and clean-URL aliases. */
import {
  DeliveryResourceSchema,
  type DeliveryManifest,
} from '../../src/domain/publication-snapshot.ts';
import { documentSecurityHeaders } from '../../src/domain/document-security.ts';
import { directoryPages } from '../../src/domain/directory-pagination.ts';
function secureAssets(response: Response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(documentSecurityHeaders)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
}
export type DeliveryStateReader = (slug: string) => Promise<unknown>;
function failure(status: 404 | 410 | 503, method: string) {
  const message =
    status === 410
      ? 'This agent is no longer available.'
      : status === 404
        ? 'This agent could not be found.'
        : 'This agent is temporarily unavailable.';
  const detail =
    status === 503
      ? 'We cannot verify the current release right now. Please try this page again shortly.'
      : status === 410
        ? 'This resource has been withdrawn from the public library. You can explore other agents below.'
        : 'The address may be incomplete, or this resource may not be published yet.';
  return new Response(
    method === 'HEAD'
      ? null
      : `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AgentGrid — resource unavailable</title><link rel="stylesheet" href="/resource-status.css"></head><body><header><a class="wordmark" href="/" aria-label="AgentGrid home">AgentGrid<span>.me</span></a><span class="network-label">The useful intelligence network</span></header><main><div class="signal-map" aria-hidden="true"><i></i><b></b><i></i></div><p class="eyebrow">Resource status / ${status}</p><h1>${message}</h1><p class="explanation">${detail}</p><a class="return-link" href="/agents/">Explore the library <span aria-hidden="true">↗</span></a></main><footer>Useful intelligence. Human judgment.</footer></body></html>`,
    {
      status,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'private, no-store',
        'cdn-cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
        'x-content-type-options': 'nosniff',
        'referrer-policy': 'strict-origin-when-cross-origin',
        'content-security-policy':
          "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        ...(status === 503 ? { 'retry-after': '60' } : {}),
      },
    },
  );
}
const listingFiles = new Set([
  '',
  'index.html',
  'index.txt',
  '__next._tree.txt',
  '__next._full.txt',
  '__next.agents.__PAGE__.txt',
]);
const directoryFiles = new Set([...listingFiles, '__next.agents.page.$d$page.__PAGE__.txt']);
export function deliveryGuard(manifest: DeliveryManifest, read: DeliveryStateReader) {
  const resources = new Map(manifest.resources.map((item) => [item.slug, item]));
  const pages = new Set(directoryPages(resources.size));
  return async (request: Request, assets: () => Promise<Response>) => {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return failure(404, request.method);
    // Encoded path aliases cannot bypass the canonical resource lookup.
    const path = url.pathname;
    if (path === '/agents')
      return new Response(null, { status: 308, headers: { location: '/agents/' + url.search } });
    if (!path.startsWith('/agents/') || /[%\\]/.test(path)) return failure(404, request.method);
    const relative = path.slice('/agents/'.length);
    if (listingFiles.has(relative)) return secureAssets(await assets());
    // Finite static directory pages only. This never authorizes detail delivery.
    const listing = relative.match(/^page\/([1-9][0-9]*)(?:\/(.*))?$/);
    if (listing && pages.has(Number(listing[1]))) {
      const file = listing[2] ?? '';
      if (directoryFiles.has(file)) return secureAssets(await assets());
    }
    const segment = relative.split('/')[0] ?? '';
    const slug = segment.replace(/\.(?:html|txt)$/, '');
    const expected = resources.get(slug);
    if (!expected) return failure(404, request.method);
    try {
      const value = await read(slug);
      if (value === null) return failure(410, request.method);
      const current = DeliveryResourceSchema.parse(value);
      if (
        current.resourceId !== expected.resourceId ||
        current.versionId !== expected.versionId ||
        current.slug !== expected.slug ||
        current.tag !== expected.tag
      )
        return failure(503, request.method);
      const response = secureAssets(await assets());
      // Never retain detail content past a live moderation/version decision.
      const headers = new Headers(response.headers);
      headers.set('cache-control', 'private, no-store');
      headers.set('cdn-cache-control', 'no-store');
      headers.set('x-content-type-options', 'nosniff');
      // Range/conditional requests must not resurrect an older client body.
      if (response.status === 304 || response.status === 206) return failure(503, request.method);
      headers.delete('etag');
      headers.delete('last-modified');
      return new Response(request.method === 'HEAD' ? null : response.body, {
        status: response.status,
        headers,
      });
    } catch {
      return failure(503, request.method);
    }
  };
}
