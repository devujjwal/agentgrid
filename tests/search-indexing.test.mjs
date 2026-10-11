import assert from 'node:assert/strict';
import test from 'node:test';
import { directoryPages, directoryPagePath } from '../src/domain/directory-pagination.ts';
import { publicationRobots } from '../src/domain/search-indexing.ts';
import { createCatalogueSearch } from '../src/domain/discovery.ts';

test('publication cannot override preview, staging, missing or unknown build-stage exclusion', () => {
  for (const stage of ['staging', 'preview', '', 'unknown']) {
    assert.deepEqual(publicationRobots(true, stage), { index: false, follow: false });
  }
  assert.deepEqual(publicationRobots(false, 'production'), { index: false, follow: false });
  assert.deepEqual(publicationRobots(true, 'production'), { index: true, follow: true });
});

test('finite catalogue pagination covers every published result exactly once before JavaScript', () => {
  const resources = Array.from({ length: 68 }, (_, index) => ({
    slug: `agent-${index}`,
    title: `Agent ${String(index).padStart(2, '0')}`,
    summary: '',
    category: 'productivity',
    capabilities: [],
    keywords: [],
    platforms: [],
  }));
  const slugs = [1, ...directoryPages(resources.length)].flatMap((page) => {
    const provider = createCatalogueSearch(resources, { text: '', offset: (page - 1) * 30 });
    assert.equal(provider.initialPage.offset, (page - 1) * 30);
    return provider.initialPage.matches.map(({ resource }) => resource.slug);
  });
  assert.equal(slugs.length, 68);
  assert.equal(new Set(slugs).size, 68);
  assert.deepEqual(directoryPages(0), []);
  assert.deepEqual(directoryPages(30), []);
  assert.deepEqual(directoryPages(31), [2]);
  assert.equal(directoryPages(100_000).length, 333);
  assert.equal(directoryPagePath(1), '/agents/');
  assert.equal(directoryPagePath(2), '/agents/page/2/');
});
