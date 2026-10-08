import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseCategoryGuides, categoryPath, categoryDiscovery } from '../src/domain/category.ts';
import { searchCatalogue } from '../src/domain/discovery.ts';
import { universeRelations } from '../src/components/universe/model.ts';
const content = JSON.parse(await readFile('content/categories/guides.json', 'utf8'));
const guides = parseCategoryGuides(content);
test('category guidance covers broad consumer tasks with safe distinct routes and related reading', () => {
  assert.deepEqual(
    new Set(guides.map((item) => item.slug)),
    new Set([
      'productivity',
      'marketing',
      'research',
      'education',
      'content',
      'ecommerce',
      'business-operations',
      'everyday',
      'seo',
      'development',
    ]),
  );
  for (const guide of guides) {
    assert.equal(categoryPath(guide.slug), `/categories/${guide.slug}/`);
    assert.ok(guide.check !== guide.stop);
  }
  assert.throws(() => categoryPath('../agents/private'));
  for (const mutate of [
    (value) => value.push(value[0]),
    (value) => value[0].related.push('unknown'),
    (value) => value[0].related.push(value[0].slug),
    (value) => (value[0].updated = '2099-01-01'),
    (value) => (value[0].runtime = 'autonomous'),
    (value) => (value[0].overview = 'sb_secret_' + 'x'.repeat(400)),
  ]) {
    const changed = structuredClone(content);
    mutate(changed);
    assert.throws(() => parseCategoryGuides(changed));
  }
});
test('category search is separate from agent verification and supports kind filters', () => {
  const resources = categoryDiscovery(guides);
  const found = searchCatalogue(resources, { text: 'household packing', kinds: ['category'] });
  assert.equal(found[0]?.resource.slug, 'category:everyday');
  assert.equal(found[0]?.resource.state, 'editorial');
  assert.equal(found[0]?.resource.format, 'guide');
  assert.deepEqual(searchCatalogue(resources, { text: 'household packing', kinds: ['agent'] }), []);
  assert.ok(resources.every((item) => item.platforms.length === 0));
  // Editorial navigation never creates a fictional capability edge.
  assert.deepEqual(universeRelations(resources), []);
  const drafts = [
    { slug: 'inbox-priority-triage', kind: 'agent', state: 'draft', connectionTags: [] },
    { slug: 'reply-draft-assistant', kind: 'agent', state: 'draft', connectionTags: [] },
  ];
  assert.deepEqual(universeRelations([...drafts, ...resources]), universeRelations(drafts));
});
