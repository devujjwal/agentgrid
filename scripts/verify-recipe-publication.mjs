/** First-party editorial recipe allowlist, separate from private drafts. */
import { readFile, lstat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readPublication } from './verify-publication.mjs';
import { parseRecipeCatalogue, availablePublishedRecipes } from '../src/domain/recipe.ts';
export async function readRecipePublication() {
  const file = resolve('content/publication/recipes.json');
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2_000_000)
    throw new Error('Invalid recipe publication file.');
  const documents = parseRecipeCatalogue(JSON.parse(await readFile(file, 'utf8')));
  const { catalogue } = await readPublication(resolve('content/publication'));
  return availablePublishedRecipes(documents, catalogue.resources);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const documents = await readRecipePublication();
  console.log(`Verified recipe publication: ${documents.length} available editorial recipes.`);
}
