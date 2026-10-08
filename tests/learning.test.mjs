import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseLearningGuides,
  learningPath,
  learningStructuredData,
} from '../src/domain/learning.ts';
import { serializeStructuredData } from '../src/domain/public-resource.ts';
const source = JSON.parse(await readFile('content/learning/guides.json', 'utf8'));
const now = new Date('2026-10-08T12:00:00Z');
test('learning content has resolvable routes, section citations and related reading', () => {
  const guides = parseLearningGuides(source, now);
  for (const guide of guides) {
    assert.equal(learningPath(guide.slug), `/learn/${guide.slug}/`);
    const structured = learningStructuredData(guide);
    assert.equal(structured['@graph'][0].headline, guide.title);
    assert.equal(structured['@graph'][0].dateModified, guide.updated);
    assert.equal(
      structured['@graph'][1].itemListElement.at(-1).item,
      `https://agentgrid.me/learn/${guide.slug}/`,
    );
    assert.ok(!('aggregateRating' in structured['@graph'][0]));
  }
});
test('editorial parser rejects unsafe sources, broken references and duplicate route/section identifiers', () => {
  for (const mutate of [
    (value) => value.push(value[0]),
    (value) => value[0].sections.push(value[0].sections[0]),
    (value) => value[0].related.push('missing-guide'),
    (value) => value[0].related.push(value[0].slug),
    (value) => (value[0].sections[0].sourceIds = ['missing-source']),
    (value) => (value[2].sources[0].url = 'javascript:alert(1)'),
    (value) => (value[2].sources[0].url = 'https://user:password@example.com/'),
    (value) => (value[0].updated = '2099-01-01'),
    (value) => (value[0].unreviewedHtml = '<script>alert(1)</script>'),
  ]) {
    const changed = structuredClone(source);
    mutate(changed);
    assert.throws(() => parseLearningGuides(changed, now));
  }
  for (const path of ['../private', 'foo?query=1', '/other/', ''])
    assert.throws(() => learningPath(path));
});
test('article structured data escapes markup rather than adding executable content', () => {
  const guide = parseLearningGuides(source, now)[0];
  const value = learningStructuredData({
    ...guide,
    title: 'Example </script><script>alert(1)</script>',
  });
  const serialized = serializeStructuredData(value);
  assert.ok(!serialized.includes('</script>'));
  assert.deepEqual(JSON.parse(serialized), value);
});
