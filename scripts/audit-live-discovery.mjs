/** Public HTTP audit only: no credentials, cookies, writes or provider execution. */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'parse5';
import { inspectCrawlDocument, sitemapPaths } from './verify-crawl-export.mjs';

const origin = 'https://agentgrid.me';
const attributes = (node) =>
  Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
const text = (node) =>
  ['script', 'style'].includes(node.tagName)
    ? ''
    : (node.childNodes ?? []).map((child) => child.value ?? text(child)).join(' ');
const get = (path) =>
  fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(20000) });
const sitemapResponse = await get('/sitemap.xml');
if (sitemapResponse.status !== 200) throw new Error('Production sitemap unavailable.');
const inventory = sitemapPaths(await sitemapResponse.text());
const pending = new Set(['/', ...inventory]),
  pages = new Map();
async function inspect(path) {
  const response = await get(path),
    html = await response.text();
  const document = inspectCrawlDocument(html, path),
    nodes = [];
  const visit = (node) => {
    nodes.push(node);
    for (const child of node.childNodes ?? []) visit(child);
  };
  visit(parse(html));
  const main = nodes.find((node) => node.tagName === 'main');
  const meta = Object.fromEntries(
    nodes
      .filter((node) => node.tagName === 'meta')
      .map((node) => {
        const a = attributes(node);
        return [a.property ?? a.name, a.content];
      }),
  );
  const schema = nodes
    .filter((node) => node.tagName === 'script' && attributes(node).type === 'application/ld+json')
    .map((node) => JSON.parse((node.childNodes ?? []).map((child) => child.value ?? '').join('')));
  pages.set(path, {
    ...document,
    ids: [...document.ids],
    status: response.status,
    headerRobots: response.headers.get('x-robots-tag'),
    words: main ? text(main).trim().split(/\s+/).length : 0,
    bytes: Buffer.byteLength(html),
    meta,
    schema,
  });
  for (const href of document.links) {
    const url = new URL(href, origin + path);
    if (
      url.origin === origin &&
      !url.search &&
      /^\/(?:$|(?:agents|recipes|categories|learn|platforms|integrations|mcp)\/)/.test(
        url.pathname,
      ) &&
      !pages.has(url.pathname)
    )
      pending.add(url.pathname);
  }
}
while (pending.size) {
  if (pages.size + pending.size > 250) throw new Error('Live audit route bound exceeded.');
  const batch = [...pending].slice(0, 4);
  batch.forEach((path) => pending.delete(path));
  await Promise.all(batch.map(inspect));
  for (const path of pages.keys()) pending.delete(path);
}
const issues = [];
const titles = new Map(),
  descriptions = new Map();
for (const page of pages.values()) {
  issues.push(...page.errors.map((error) => `${page.path}: ${error}`));
  if (page.status !== 200) issues.push(`${page.path}: HTTP ${page.status}`);
  if (inventory.includes(page.path) && (page.noindex || /noindex/i.test(page.headerRobots ?? '')))
    issues.push(`${page.path}: sitemap URL excluded from indexing`);
  if (!page.noindex) {
    for (const [map, value, label] of [
      [titles, page.title, 'title'],
      [descriptions, page.description, 'description'],
    ]) {
      if (map.has(value)) issues.push(`${page.path}: duplicate ${label} with ${map.get(value)}`);
      map.set(value, page.path);
    }
    if (!page.meta['og:image'] || !page.meta['twitter:card'])
      issues.push(`${page.path}: social preview missing`);
  }
  for (const href of page.links) {
    const url = new URL(href, origin + page.path),
      target = url.origin === origin ? pages.get(url.pathname) : undefined;
    if (target && url.hash && !target.ids.includes(decodeURIComponent(url.hash.slice(1))))
      issues.push(`${page.path}: missing fragment ${href}`);
  }
}
const probes = [];
for (const path of [
  '/agents',
  '/index.html',
  '/agents/inbox-priority-triage/index.html',
  '/does-not-exist-audit/',
  '/agents/does-not-exist-audit/',
  '/workspace/',
  '/sign-in/',
  '/saves/',
  '/privacy/',
  '/terms/',
  '/creators/devujjwal/',
]) {
  const response = await get(path),
    html = await response.text();
  probes.push({
    path,
    status: response.status,
    location: response.headers.get('location'),
    headerRobots: response.headers.get('x-robots-tag'),
    metaRobots: html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? null,
  });
}
const bots = [];
for (const bot of ['Googlebot', 'bingbot', 'OAI-SearchBot', 'PerplexityBot']) {
  const response = await fetch(origin + '/sitemap.xml', {
    headers: { 'User-Agent': bot },
    signal: AbortSignal.timeout(20000),
  });
  bots.push({ bot, status: response.status, contentType: response.headers.get('content-type') });
}
const report = {
  checked_at: new Date().toISOString(),
  origin,
  release: await (await get('/agentgrid-release.json')).json(),
  robots: await (await get('/robots.txt')).text(),
  inventory,
  pages: [...pages.values()],
  issues,
  probes,
  bots,
  caveat:
    'User-agent probes do not establish access from verified crawler IPs. HTTP eligibility and submission do not establish indexing or rankings.',
};
const output = process.argv[2];
if (output) await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      pages: pages.size,
      sitemapURLs: inventory.length,
      indexable: [...pages.values()].filter((page) => !page.noindex).length,
      issues,
      probes,
      bots,
    },
    null,
    2,
  ),
);
if (issues.length) process.exitCode = 1;
