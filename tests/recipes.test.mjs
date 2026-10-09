import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  parseRecipeDrafts,
  parseRecipeCatalogue,
  recipeReferencesMatch,
  availablePublishedRecipes,
  recipePath,
} from '../src/domain/recipe.ts';
import { searchCatalogue } from '../src/domain/discovery.ts';
const drafts = parseRecipeDrafts(JSON.parse(await readFile('content/recipes/drafts.json', 'utf8')));
const specifications = [];
for (const reference of new Set(
  drafts.flatMap((recipe) =>
    recipe.steps.map((step) => `${step.agent_slug}/${step.agent_version}`),
  ),
))
  specifications.push(JSON.parse(await readFile(`content/agents/${reference}.agent.json`, 'utf8')));
test('guided recipes reference exact instruction packages and preserve concrete handoff checks', async () => {
  assert.equal(drafts.length, 6);
  for (const recipe of drafts) {
    assert.equal(await recipeReferencesMatch(recipe, specifications), true, recipe.slug);
    assert.equal(await recipeReferencesMatch(recipe, []), false);
    assert.equal(recipePath(recipe.slug), `/recipes/${recipe.slug}/`);
    const changed = structuredClone(specifications);
    changed.find((spec) => spec.identity.slug === recipe.steps[0].agent_slug).identity.summary +=
      ' Updated task.';
    assert.equal(await recipeReferencesMatch(recipe, changed), false);
  }
});
test('publication requires a reviewed envelope and current pinned dependencies; drafts never become public', async () => {
  const now = new Date('2026-10-08T12:00:00Z');
  const envelope = {
    contract_version: '0.1',
    recipes: [
      {
        recipe: drafts[0],
        publication: { reviewed_on: '2026-10-08', released_at: '2026-10-08T08:00:00Z' },
      },
    ],
  };
  const parsed = parseRecipeCatalogue(envelope, now);
  const resources = specifications.map((specification) => ({ specification }));
  assert.equal((await availablePublishedRecipes(parsed, resources)).length, 1);
  assert.equal((await availablePublishedRecipes(parsed, [])).length, 0);
  assert.equal(
    (await availablePublishedRecipes([{ recipe: drafts[0], publication: null }], resources)).length,
    0,
  );
  for (const mutate of [
    (value) => (value.recipes[0].publication = null),
    (value) => (value.recipes[0].publication.reviewed_on = '2099-01-01'),
    (value) => (value.recipes[0].recipe.mode = 'autonomous'),
    (value) => (value.recipes[0].recipe.steps[0].agent_slug = '../private'),
  ]) {
    const changed = structuredClone(envelope);
    mutate(changed);
    assert.throws(() => parseRecipeCatalogue(changed, now));
  }
  assert.deepEqual(
    parseRecipeCatalogue(
      JSON.parse(await readFile('content/publication/recipes.json', 'utf8')),
      now,
    ),
    [],
  );
});
test('recipe discovery finds an outcome and can be restricted by resource kind', () => {
  const resources = drafts.map((recipe) => ({
    slug: `recipe:${recipe.slug}`,
    kind: 'recipe',
    title: recipe.title,
    summary: recipe.summary,
    category: recipe.category,
    capabilities: [recipe.outcome],
    keywords: recipe.keywords,
    connectionTags: [],
    platforms: [],
    href: recipePath(recipe.slug),
    state: 'draft',
    creatorName: 'AgentGrid Editorial draft',
    format: 'recipe',
  }));
  assert.equal(
    searchCatalogue(resources, { text: 'meeting follow-up', kinds: ['recipe'] })[0]?.resource.slug,
    'recipe:turn-meeting-notes-into-follow-up',
  );
  assert.deepEqual(searchCatalogue(resources, { text: 'meeting follow-up', kinds: ['agent'] }), []);
});
