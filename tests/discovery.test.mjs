import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { searchCatalogue, createCatalogueSearch } from '../src/domain/discovery.ts';
import { discoveryKeywords } from '../src/data/discovery-metadata.ts';
import { draftRelations, layoutUniverse } from '../src/components/universe/model.ts';

const resources = [];
for (const slug of await readdir('content/agents')) {
  const spec = JSON.parse(await readFile(`content/agents/${slug}/1.0.0.agent.json`, 'utf8'));
  resources.push({
    slug,
    kind: 'agent',
    title: spec.identity.name,
    summary: spec.identity.summary,
    category: spec.category,
    capabilities: spec.capabilities.map((item) => item.name),
    keywords: discoveryKeywords[slug] ?? [],
    platforms: ['chatgpt'],
    href: '#resource-inspector',
  });
}

test('literal discovery finds specific consumer tasks without unrelated verb-only results', async () => {
  const cases = [
    ['audit my seo', 'search-opportunity-auditor'],
    ['Plan a campaign', 'campaign-message-planner'],
    ['triage my emails', 'inbox-priority-triage'],
    ['help me study', 'retrieval-study-coach'],
    ['review a code diff', 'pull-request-reviewer'],
    ['edit my article', 'article-structure-editor'],
    ['audit a product listing', 'product-listing-auditor'],
    ['meeting decisions', 'meeting-decision-ledger'],
    ['compare research sources', 'source-evidence-mapper'],
    ['plan household meals', 'household-meal-planner'],
  ];
  for (const [text, slug] of cases)
    assert.equal((await createCatalogueSearch(resources).search({ text }))[0]?.resource.slug, slug);
  assert.deepEqual(
    searchCatalogue(resources, { text: 'audit my seo' }).map((match) => match.resource.slug),
    ['search-opportunity-auditor'],
  );
  assert.deepEqual(searchCatalogue(resources, { text: 'competitor monitoring' }), []);
});

test('discovery contracts bound results and honor category/kind without inventing capabilities', () => {
  assert.equal(
    searchCatalogue(resources, { text: '', category: 'everyday' })[0]?.resource.slug,
    'household-meal-planner',
  );
  assert.deepEqual(searchCatalogue(resources, { text: '', kinds: ['integration'] }), []);
  assert.equal(searchCatalogue(resources, { text: '', limit: 2 }).length, 2);
  assert.equal(
    searchCatalogue(resources, { text: 'ＦＩＮＤ an agent that audits my SEO' })[0]?.resource.slug,
    'search-opportunity-auditor',
  );
  assert.ok(searchCatalogue(resources, { text: 'a'.repeat(5000) }).length <= 60);
});

test('compact graph shows bounded actual neighbors and desktop includes a selection in a broader library', () => {
  const matches = resources.map((item) => item.slug);
  const compact = layoutUniverse(
    resources,
    draftRelations,
    matches,
    'source-evidence-mapper',
    true,
  );
  assert.ok(compact.nodes.length <= 4);
  assert.equal(compact.nodes[0].resource.slug, 'source-evidence-mapper');
  for (const edge of compact.edges) {
    assert.ok(compact.nodes.some((node) => node.resource.slug === edge.source));
    assert.ok(compact.nodes.some((node) => node.resource.slug === edge.target));
    assert.ok(draftRelations.includes(edge));
  }
  const broader = Array.from({ length: 100 }, (_, index) => ({
    ...resources[0],
    slug: `resource-${index}`,
  }));
  const desktop = layoutUniverse(
    broader,
    [],
    broader.map((item) => item.slug),
    'resource-99',
    false,
  );
  assert.equal(desktop.nodes.length, 24);
  assert.ok(desktop.nodes.some((node) => node.resource.slug === 'resource-99'));
  assert.equal(layoutUniverse(resources, draftRelations, [], '', true).nodes.length, 0);
});
