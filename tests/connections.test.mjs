import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseConnectionGuides,
  connectionPath,
  needsConnectionReview,
  declaresConnection,
  integrationDiscovery,
} from '../src/domain/connection-guide.ts';
import { searchCatalogue } from '../src/domain/discovery.ts';
const content = JSON.parse(await readFile('content/connections/guides.json', 'utf8'));
const categories = JSON.parse(await readFile('content/categories/guides.json', 'utf8')).map(
  (item) => item.slug,
);
const now = new Date('2026-10-08T12:00:00Z');
const guides = parseConnectionGuides(content, categories, now);
test('connection guidance rejects unsafe sources, routes, undeclared fields and invalid editorial dates', () => {
  for (const mutate of [
    (v) => v.push(v[0]),
    (v) => (v[0].slug = '../private'),
    (v) => (v[0].kind = 'server'),
    (v) => (v[0].categories = ['unknown']),
    (v) => v[0].categories.push(v[0].categories[0]),
    (v) => (v[0].checked_on = '2099-01-01'),
    (v) => (v[0].review_after = v[0].checked_on),
    (v) => (v[0].runtime = 'connected'),
    (v) => (v[0].summary = 'sb_secret_' + 'x'.repeat(150)),
    ...[
      'javascript:alert(1)',
      'https://support.google.com.evil.test/',
      'https://name:password@support.google.com/',
      'http://support.google.com/',
      'https://support.google.com:8080/',
    ].map((url) => (v) => (v[0].sources[0].url = url)),
  ]) {
    const changed = structuredClone(content);
    mutate(changed);
    assert.throws(() => parseConnectionGuides(changed, categories, now));
  }
  assert.throws(() => connectionPath({ kind: 'platform', slug: '../private' }));
  assert.throws(() => connectionPath({ kind: 'unknown', slug: 'safe' }));
  const gemini = guides.find((item) => item.slug === 'gemini');
  assert.equal(needsConnectionReview(gemini, new Date('2026-10-31T23:59:59Z')), false);
  assert.equal(needsConnectionReview(gemini, new Date('2026-11-01T00:00:00Z')), true);
});
test('resource relationships require exact declarations and protocol guidance never implies a server installation', () => {
  const chatgpt = guides.find((item) => item.slug === 'chatgpt');
  const github = guides.find((item) => item.slug === 'github');
  const mcp = guides.find((item) => item.kind === 'mcp');
  const spec = { platforms: [{ slug: 'chatgpt' }], tools: [{ kind: 'integration', id: 'github' }] };
  assert.equal(declaresConnection(spec, chatgpt), true);
  assert.equal(declaresConnection(spec, github), true);
  assert.equal(declaresConnection(spec, mcp), false);
  assert.equal(
    declaresConnection({ ...spec, platforms: [{ slug: 'chatgpt-unverified' }] }, chatgpt),
    false,
  );
  assert.equal(
    declaresConnection({ ...spec, tools: [{ kind: 'mcp', id: 'github' }] }, github),
    false,
  );
  assert.equal(declaresConnection({ ...spec, tools: [] }, github), false);
});
test('integration search exposes editorial guidance without implying reviewed agents or executable packages', () => {
  const resources = integrationDiscovery(guides);
  assert.equal(resources.length, 2);
  assert.ok(
    resources.every(
      (item) =>
        item.state === 'editorial' && item.format === 'guide' && item.platforms.length === 0,
    ),
  );
  assert.equal(
    searchCatalogue(resources, { text: 'Google Search Console export', kinds: ['integration'] })[0]
      ?.resource.slug,
    'integration:google-search-console',
  );
  assert.deepEqual(searchCatalogue(resources, { text: 'github', kinds: ['agent'] }), []);
});
