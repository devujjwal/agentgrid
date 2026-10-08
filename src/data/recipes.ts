import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  availablePublishedRecipes,
  parseRecipeCatalogue,
  parseRecipeDrafts,
  recipeReferencesMatch,
  recipePath,
  type RecipeDocument,
} from '../domain/recipe';
import { publicResources, resourceDocuments } from './resources';
import type { DiscoveryResource } from '../domain/discovery';
function read(path: string) {
  const bytes = readFileSync(resolve(path));
  if (bytes.byteLength > 2_000_000) throw new Error('Recipe content exceeds build bounds.');
  return JSON.parse(bytes.toString('utf8')) as unknown;
}
export async function publicRecipes(): Promise<RecipeDocument[]> {
  return availablePublishedRecipes(
    parseRecipeCatalogue(read('content/publication/recipes.json')),
    publicResources(),
  );
}
export async function recipeDocuments(): Promise<RecipeDocument[]> {
  if (process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1') return publicRecipes();
  if (process.env.CI || process.env.GITHUB_ACTIONS)
    throw new Error('Draft recipes are local-only.');
  const recipes = parseRecipeDrafts(read('content/recipes/drafts.json'));
  const specs = resourceDocuments().map((document) => document.specification);
  for (const recipe of recipes)
    if (!(await recipeReferencesMatch(recipe, specs)))
      throw new Error(`Draft recipe dependencies changed: ${recipe.slug}`);
  return recipes.map((recipe) => ({ recipe, publication: null }));
}
export async function recipeDiscovery(): Promise<DiscoveryResource[]> {
  return (await recipeDocuments()).map(({ recipe, publication }) => ({
    // Discovery identity is qualified; the recipe URL retains its own slug.
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
    state: publication ? 'published' : 'draft',
    creatorName: publication ? 'AgentGrid Editorial' : 'AgentGrid Editorial draft',
    format: 'recipe',
  }));
}
