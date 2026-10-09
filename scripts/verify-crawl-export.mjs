/** Read-only generated-output audit. No provider calls, credentials or indexing changes. */
import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { parse } from 'parse5';
import { readPublication } from './verify-publication.mjs';
import { readRecipePublication } from './verify-recipe-publication.mjs';

const origin = 'https://agentgrid.me';
const publicRoute =
  /^\/(?:$|(?:agents|recipes|categories|learn|platforms|integrations|mcp)\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)?)$/;
const creatorRoute = /^\/creators\/[a-z][a-z0-9_]{2,29}\/$/;
const text = (node) => (node.childNodes ?? []).map((child) => child.value ?? text(child)).join('');
const attrs = (node) =>
  Object.fromEntries((node.attrs ?? []).map(({ name, value }) => [name, value]));
const pathFor = (name) =>
  name === 'index.html'
    ? '/'
    : name.endsWith('/index.html')
      ? '/' + name.slice(0, -10)
      : '/' + name;

export function inspectCrawlDocument(html, path) {
  if (Buffer.byteLength(html) > 2_000_000) throw new Error('HTML audit bound exceeded.');
  const nodes = [],
    errors = [],
    ids = new Set();
  function visit(node) {
    nodes.push(node);
    const id = attrs(node).id;
    if (id) {
      if (ids.has(id)) errors.push('duplicate element ID');
      ids.add(id);
    }
    for (const child of node.childNodes ?? []) visit(child);
  }
  visit(parse(html));
  const elements = (tag) => nodes.filter((node) => node.tagName === tag);
  const meta = (name) =>
    elements('meta')
      .filter((node) => attrs(node).name === name)
      .map((node) => attrs(node).content ?? '');
  const titles = elements('title').map(text);
  const descriptions = meta('description');
  const canonicals = elements('link')
    .filter((node) => (attrs(node).rel ?? '').split(/\s+/).includes('canonical'))
    .map((node) => attrs(node).href);
  const robots = meta('robots')
    .join(',')
    .toLowerCase()
    .split(/[\s,]+/);
  if (elements('html').length !== 1 || attrs(elements('html')[0]).lang !== 'en')
    errors.push('missing document language');
  if (titles.length !== 1 || !titles[0].trim()) errors.push('missing or duplicate title');
  if (descriptions.length !== 1 || !descriptions[0].trim())
    errors.push('missing or duplicate description');
  if (elements('h1').length !== 1 || !text(elements('h1')[0]).trim())
    errors.push('expected one meaningful H1');
  if (elements('main').length !== 1) errors.push('expected one main landmark');
  if (publicRoute.test(path)) {
    if (canonicals.length !== 1 || canonicals[0] !== origin + path)
      errors.push('canonical does not match the clean production URL');
  } else if (!robots.includes('noindex')) errors.push('private/status route must be noindex');
  if (robots.includes('index') && robots.includes('noindex'))
    errors.push('conflicting robots directives');
  for (const script of elements('script').filter(
    (node) => attrs(node).type === 'application/ld+json',
  )) {
    try {
      const value = JSON.parse(text(script));
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        value['@context'] !== 'https://schema.org'
      )
        throw new Error();
    } catch {
      errors.push('invalid structured-data JSON/context');
    }
  }
  return {
    path,
    title: titles[0] ?? '',
    description: descriptions[0] ?? '',
    ids,
    noindex: robots.includes('noindex'),
    links: elements('a')
      .map((node) => attrs(node).href)
      .filter(Boolean),
    errors,
  };
}

/** Accept the bounded Next sitemap subset currently emitted by this application. */
export function sitemapPaths(xml) {
  if (Buffer.byteLength(xml) > 3_000_000) throw new Error('Sitemap bound exceeded.');
  const body = xml.match(
    /^\s*<\?xml version="1\.0" encoding="UTF-8"\?>\s*<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">([\s\S]*)<\/urlset>\s*$/,
  )?.[1];
  if (body === undefined) throw new Error('Unexpected sitemap envelope.');
  const paths = [];
  const remainder = body.replace(
    /<url>\s*<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>\s*)?<\/url>/g,
    (_, loc, date) => {
      const url = new URL(loc);
      if (
        url.origin !== origin ||
        url.search ||
        url.hash ||
        url.username ||
        url.password ||
        !publicRoute.test(url.pathname) ||
        loc !== origin + url.pathname ||
        (date && !Number.isFinite(Date.parse(date)))
      )
        throw new Error('Invalid sitemap location or date.');
      paths.push(url.pathname);
      return '';
    },
  );
  if (remainder.trim() || new Set(paths).size !== paths.length)
    throw new Error('Malformed or duplicate sitemap entries.');
  return paths;
}

export async function verifyCrawlExport(root, expectedSitemapPaths) {
  const documents = new Map(),
    files = new Set(),
    errors = [];
  if ((await lstat(root)).isSymbolicLink()) throw new Error('Symbolic export root refused.');
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symbolic export entry refused.');
      const absolute = resolve(directory, entry.name),
        name = relative(root, absolute).replaceAll('\\', '/');
      if (entry.isDirectory()) await walk(absolute);
      else if (entry.isFile()) {
        files.add('/' + name);
        if (name.endsWith('.html')) {
          if ((await lstat(absolute)).size > 2_000_000)
            throw new Error('HTML audit bound exceeded.');
          if (documents.size >= 10050) throw new Error('Document count exceeds audit bound.');
          const path = pathFor(name),
            result = inspectCrawlDocument(await readFile(absolute, 'utf8'), path);
          documents.set(path, result);
          errors.push(...result.errors.map((error) => `${path}: ${error}`));
        }
      }
    }
  }
  await walk(root);
  if (!documents.size) throw new Error('No generated documents to audit.');
  const titles = new Set(),
    descriptions = new Set();
  let links = 0;
  for (const page of documents.values()) {
    if (publicRoute.test(page.path)) {
      if (titles.has(page.title)) errors.push(`${page.path}: duplicate public-page title`);
      titles.add(page.title);
      if (descriptions.has(page.description))
        errors.push(`${page.path}: duplicate public-page description`);
      descriptions.add(page.description);
    }
    for (const href of page.links) {
      let url;
      try {
        url = new URL(href, origin + page.path);
      } catch {
        errors.push(`${page.path}: malformed link`);
        continue;
      }
      if (url.origin !== origin) continue;
      links++;
      // Explicit dynamic creator family is served by the Worker, not static HTML.
      if (creatorRoute.test(url.pathname)) continue;
      const target = documents.get(url.pathname);
      if (!target && !files.has(url.pathname))
        errors.push(`${page.path}: missing internal target ${url.pathname}`);
      if (target && url.hash) {
        let id;
        try {
          id = decodeURIComponent(url.hash.slice(1));
        } catch {
          errors.push(`${page.path}: malformed fragment`);
          continue;
        }
        if (!target.ids.has(id))
          errors.push(`${page.path}: missing fragment ${url.pathname}${url.hash}`);
      }
    }
  }
  const sitemap = sitemapPaths(await readFile(resolve(root, 'sitemap.xml'), 'utf8'));
  const expected = new Set(expectedSitemapPaths);
  if (sitemap.length !== expected.size || sitemap.some((path) => !expected.has(path)))
    errors.push('Sitemap differs from the reviewed publication inventory.');
  for (const path of sitemap) {
    const page = documents.get(path);
    if (!page || page.noindex) errors.push(`${path}: sitemap target is missing or marked noindex`);
  }
  if (errors.length)
    throw new Error('Generated crawl audit failed:\n' + errors.slice(0, 50).join('\n'));
  return { documents: documents.size, internalLinks: links, sitemapEntries: sitemap.length };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const { catalogue } = await readPublication(resolve('content/publication'));
  const recipes = await readRecipePublication();
  const result = await verifyCrawlExport(resolve('out'), [
    ...catalogue.resources.map((resource) => `/agents/${resource.specification.identity.slug}/`),
    ...recipes.map(({ recipe }) => `/recipes/${recipe.slug}/`),
  ]);
  console.log(
    `Crawl output verified: ${result.documents} documents, ${result.internalLinks} internal links, ${result.sitemapEntries} released sitemap URLs. This does not enable indexing or prove provider delivery.`,
  );
}
