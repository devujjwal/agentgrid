import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  inspectCrawlDocument,
  sitemapPaths,
  verifyCrawlExport,
} from '../scripts/verify-crawl-export.mjs';

const document = (path, content = '', robots = 'noindex, nofollow') =>
  `<!doctype html><html lang="en"><head><title>AgentGrid ${path}</title><meta name="description" content="Useful resource context for ${path}"><meta name="robots" content="${robots}"><link rel="canonical" href="https://agentgrid.me${path}"></head><body><main id="main"><h1>Useful resource</h1>${content}</main></body></html>`;
const sitemap = (body = '') =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;

test('crawl document checks delivered semantics, canonical identity and private indexing', () => {
  assert.deepEqual(inspectCrawlDocument(document('/agents/'), '/agents/').errors, []);
  for (const html of [
    document('/agents/').replace('https://agentgrid.me/agents/', 'https://preview.example/agents/'),
    document('/agents/').replace('</head>', '<title>Duplicate</title></head>'),
    document('/agents/').replace('</main>', '<h1>Duplicate</h1></main>'),
    document('/agents/').replace('id="main"', 'id="main"><span id="main"></span'),
    document('/agents/', '<script type="application/ld+json">{"broken":</script>'),
    document(
      '/agents/',
      '<script type="application/ld+json">{"@context":"https://wrong.example"}</script>',
    ),
  ])
    assert.ok(inspectCrawlDocument(html, '/agents/').errors.length);
  assert.ok(
    inspectCrawlDocument(document('/workspace/', '', 'index, follow'), '/workspace/').errors.some(
      (value) => value.includes('private/status'),
    ),
  );
  assert.deepEqual(
    inspectCrawlDocument(
      document(
        '/agents/',
        '<script type="application/ld+json">{"@context":"https://schema.org","@type":"CreativeWork"}</script>',
      ),
      '/agents/',
    ).errors,
    [],
  );
});

test('sitemap gate rejects query variants, private destinations, duplicates and malformed XML', () => {
  assert.deepEqual(sitemapPaths(sitemap()), []);
  assert.deepEqual(
    sitemapPaths(
      sitemap(
        '<url><loc>https://agentgrid.me/agents/test-agent/</loc><lastmod>2026-10-08T00:00:00Z</lastmod></url>',
      ),
    ),
    ['/agents/test-agent/'],
  );
  for (const url of [
    'https://wrong.example/agents/',
    'https://agentgrid.me/workspace/',
    'https://agentgrid.me/agents/?q=test',
    'https://agentgrid.me/agents/#test',
    'https://user@agentgrid.me/agents/',
  ])
    assert.throws(() => sitemapPaths(sitemap(`<url><loc>${url}</loc></url>`)));
  assert.throws(() =>
    sitemapPaths(sitemap('<url><loc>https://agentgrid.me/agents/</loc></url>'.repeat(2))),
  );
  assert.throws(() => sitemapPaths(sitemap('<url><loc>https://agentgrid.me/agents/</loc>')));
  assert.throws(() => sitemapPaths(sitemap().replace('</urlset>', '<!DOCTYPE external></urlset>')));
});

test('output gate resolves links/anchors and refuses inventory or private-route regressions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agentgrid-crawl-'));
  try {
    await mkdir(join(root, 'agents'), { recursive: true });
    await mkdir(join(root, 'workspace'), { recursive: true });
    await writeFile(
      join(root, 'index.html'),
      document(
        '/',
        '<a href="/agents/#main">Agents</a><a href="/creators/editorial/">Creator</a><a href="/workspace/?return=agents">Workspace</a>',
      ),
    );
    await writeFile(
      join(root, 'agents/index.html'),
      document('/agents/', '<a href="/#main">Home</a>', 'index, follow'),
    );
    await writeFile(join(root, 'workspace/index.html'), document('/workspace/'));
    await writeFile(
      join(root, 'sitemap.xml'),
      sitemap('<url><loc>https://agentgrid.me/agents/</loc></url>'),
    );
    assert.deepEqual(await verifyCrawlExport(root, ['/agents/']), {
      documents: 3,
      internalLinks: 4,
      sitemapEntries: 1,
    });
    await assert.rejects(verifyCrawlExport(root, []), /reviewed publication inventory/);
    await writeFile(
      join(root, 'agents/index.html'),
      document('/agents/', '<a href="/missing/">Broken</a><a href="/#absent">Broken anchor</a>'),
    );
    await assert.rejects(
      verifyCrawlExport(root, ['/agents/']),
      /missing internal target.*missing\/[\s\S]*missing fragment[\s\S]*marked noindex/,
    );
    await symlink(join(root, 'index.html'), join(root, 'alias.html'));
    await assert.rejects(verifyCrawlExport(root, ['/agents/']), /Symbolic export entry/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
