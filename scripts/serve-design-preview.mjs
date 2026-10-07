/** Loopback-only read-only static preview; never a production server. */
import { createServer } from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve('.agentgrid-local-preview');
const types = {
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.json': 'application/json',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};
if (process.env.CI || process.env.GITHUB_ACTIONS)
  throw new Error('Local preview is forbidden in CI.');
if (!(await readFile(resolve(root, 'index.html'), 'utf8')).includes('Local design preview'))
  throw new Error('Build the local preview first.');
const synthetic = process.argv.includes('--synthetic-community-qa');
const port = 3027;
const privateBoundary = synthetic
  ? await (await import('./synthetic-community-preview.mjs')).syntheticCommunityPreview()
  : process.argv.includes('--owner-live-auth')
    ? await (await import('./owner-identity-preview.mjs')).ownerIdentityPreview()
    : null;
const server = createServer(async (request, response) => {
  if (
    privateBoundary &&
    (request.url?.startsWith('/api/') ||
      request.url?.startsWith('/auth/callback/') ||
      (synthetic && ['/qa-control/', '/qa-tools.js'].includes(request.url)))
  ) {
    await privateBoundary.request(request, response);
    return;
  }
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'private, no-cache');
  response.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  if (
    !(synthetic ? ['localhost:3027'] : ['127.0.0.1:3027', 'localhost:3027']).includes(
      request.headers.host ?? '',
    ) ||
    !['GET', 'HEAD'].includes(request.method ?? '') ||
    (request.url?.length ?? 0) > 2048
  ) {
    response.writeHead(400).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(
      new URL(request.url ?? '/', 'http://127.0.0.1:3027').pathname,
    );
    const candidate = resolve(
      root,
      '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname),
    );
    const path = await realpath(candidate);
    const type = types[extname(path)];
    if (
      !path.startsWith(root + sep) ||
      !type ||
      !(await stat(path)).isFile() ||
      (await stat(path)).size > 2_000_000
    )
      throw new Error('Not a preview asset');
    response.setHeader('Content-Type', type + (type.startsWith('text/') ? '; charset=utf-8' : ''));
    const original = await readFile(path);
    const bytes =
      synthetic && type === 'text/html'
        ? Buffer.from(
            original
              .toString('utf8')
              .replace('</body>', '<script src="/qa-tools.js"></script></body>'),
          )
        : original;
    const compress =
      /\bgzip\b/.test(request.headers['accept-encoding'] ?? '') &&
      bytes.byteLength > 1024 &&
      type !== 'font/woff2';
    const body = compress ? gzipSync(bytes) : bytes;
    if (compress) response.setHeader('Content-Encoding', 'gzip');
    response.setHeader('Vary', 'Accept-Encoding');
    response.setHeader('Content-Length', body.byteLength);
    if (pathname.startsWith('/_next/static/'))
      response.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    response.writeHead(200).end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response
      .writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      .end(request.method === 'HEAD' ? undefined : await readFile(resolve(root, '404.html')));
  }
});
server.listen(port, '127.0.0.1', () =>
  console.log(
    synthetic
      ? 'Synthetic memory-only community acceptance: http://localhost:3027/sign-in/ (no provider traffic)'
      : privateBoundary
        ? 'Local owner-only live identity acceptance: http://localhost:3027/sign-in/ (no profile seeding)'
        : 'Local optimized design preview: http://127.0.0.1:3027/',
  ),
);
if (privateBoundary) {
  let closing = false;
  const close = () => {
    if (closing) return;
    closing = true;
    server.close(() => {});
    void privateBoundary.close().finally(() => process.exit());
  };
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}
