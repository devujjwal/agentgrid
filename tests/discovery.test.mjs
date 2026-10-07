import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import {
  searchCatalogue,
  searchCataloguePage,
  createCatalogueSearch,
} from '../src/domain/discovery.ts';
import { discoveryKeywords } from '../src/data/discovery-metadata.ts';
import {
  draftRelations,
  layoutUniverse,
  universeRelations,
} from '../src/components/universe/model.ts';

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
    connectionTags: [],
    platforms: ['chatgpt'],
    href: '#resource-inspector',
    state: 'draft',
    creatorName: 'AgentGrid Editorial draft',
    format: 'instructions',
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
    ['Find an agent that summarizes my important emails', 'inbox-priority-triage'],
    ['help me turn my lesson notes into a quiz', 'retrieval-study-coach'],
    ['plan dinners from ingredients I already have', 'household-meal-planner'],
    ['find pages losing organic traffic', 'search-opportunity-auditor'],
    ['help me improve product titles and bullets', 'product-listing-auditor'],
    ['What does this research actually support?', 'source-evidence-mapper'],
    ['Review GitHub PRs for security risks', 'pull-request-reviewer'],
    ['Turn a meeting transcript into action items', 'meeting-decision-ledger'],
  ];
  for (const [text, slug] of cases)
    assert.equal(
      (await createCatalogueSearch(resources).search({ text })).matches[0]?.resource.slug,
      slug,
    );
  assert.deepEqual(
    searchCatalogue(resources, { text: 'audit my seo' }).map((match) => match.resource.slug),
    ['search-opportunity-auditor'],
  );
  assert.deepEqual(searchCatalogue(resources, { text: 'competitor monitoring' }), []);
  for (const text of [
    'monitor competitors weekly',
    'send Gmail emails automatically',
    'Turn Figma designs into React',
    'Generate Instagram content',
  ])
    assert.deepEqual(searchCatalogue(resources, { text }), []);
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

test('short task terms cannot match arbitrary substrings and catalogue paging loses no resources', () => {
  assert.deepEqual(
    searchCatalogue(resources, { text: 'PR' }).map((item) => item.resource.slug),
    ['pull-request-reviewer'],
  );
  assert.deepEqual(
    searchCatalogue(resources, { text: 'PRs' }).map((item) => item.resource.slug),
    ['pull-request-reviewer'],
  );
  assert.deepEqual(searchCatalogue(resources, { text: 'claude' }), []);
  const broader = Array.from({ length: 100 }, (_, index) => ({
    ...resources[0],
    slug: `resource-${index}`,
    title: `Resource ${String(index).padStart(3, '0')}`,
  }));
  const pages = [0, 30, 60, 90].map((offset) => searchCataloguePage(broader, { text: '', offset }));
  assert.equal(pages[0].total, 100);
  const slugs = pages.flatMap((page) => page.matches.map((item) => item.resource.slug));
  assert.equal(slugs.length, 100);
  assert.equal(new Set(slugs).size, 100);
  assert.equal(searchCataloguePage(broader, { text: '', offset: -100 }).offset, 0);
});

test('public network connections use reviewed shared tags rather than stale draft relationships', () => {
  const published = resources.map((resource) => ({
    ...resource,
    state: 'published',
    connectionTags: [],
  }));
  assert.deepEqual(universeRelations(published), []);
  published[0].connectionTags = ['evidence-analysis'];
  published[1].connectionTags = ['evidence-analysis'];
  assert.deepEqual(universeRelations(published), [
    { source: published[0].slug, target: published[1].slug, capability: 'evidence analysis' },
  ]);
  const large = Array.from({ length: 2000 }, (_, index) => ({
    ...published[0],
    slug: `agent-${index}`,
  }));
  assert.ok(universeRelations(large).length <= 1200);
});
