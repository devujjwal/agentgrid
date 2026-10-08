import { z } from 'zod';
import { contentChecksum } from './content-checksum.ts';
import { hasCredentialSignature } from './public-content.ts';
import { assertJsonDocumentBounds, type AgentSpecification } from './agent-specification.ts';
import type { PublicResource } from './public-resource.ts';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const version = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .max(24);
export const RecipeSchema = z.strictObject({
  slug,
  version,
  title: text(15, 120),
  summary: text(60, 260),
  category: slug,
  mode: z.literal('guided'),
  overview: text(200, 3000),
  inputs: z.array(text(30, 500)).min(2).max(8),
  outcome: text(60, 600),
  steps: z
    .array(
      z.strictObject({
        agent_slug: slug,
        agent_version: version,
        specification_sha256: z.string().regex(/^[a-f0-9]{64}$/),
        title: text(10, 120),
        send: text(60, 1200),
        check: text(60, 1200),
        handoff: text(60, 1200),
      }),
    )
    .min(2)
    .max(5),
  checkpoint: text(60, 800),
  example: z.strictObject({ input: text(60, 1500), expected: text(60, 1500) }),
  limitations: z.array(text(60, 600)).min(2).max(6),
  keywords: z.array(text(2, 80)).min(3).max(30),
});
export type Recipe = z.infer<typeof RecipeSchema>;
const publication = z.strictObject({
  reviewed_on: z.iso.date(),
  released_at: z.iso.datetime({ offset: true }),
});
export type RecipePublication = z.infer<typeof publication>;
export interface RecipeDocument {
  recipe: Recipe;
  publication: RecipePublication | null;
}
export function parseRecipeDrafts(value: unknown): Recipe[] {
  assertJsonDocumentBounds(value);
  if (hasCredentialSignature(value)) throw new Error('Potential credential in recipe content.');
  const recipes = z.array(RecipeSchema).max(200).parse(value);
  if (new Set(recipes.map((recipe) => recipe.slug)).size !== recipes.length)
    throw new Error('Duplicate recipe path.');
  return recipes;
}
export function parseRecipeCatalogue(value: unknown, now = new Date()): RecipeDocument[] {
  const parsed = z
    .strictObject({
      contract_version: z.literal('0.1'),
      recipes: z.array(z.strictObject({ recipe: RecipeSchema, publication })).max(200),
    })
    .parse(value);
  parseRecipeDrafts(parsed.recipes.map((item) => item.recipe));
  for (const { publication: release } of parsed.recipes) {
    const review = Date.parse(release.reviewed_on + 'T00:00:00Z'),
      released = Date.parse(release.released_at);
    if (review > released || released > now.getTime() || released - review > 90 * 86400000)
      throw new Error('Invalid recipe review/release dates.');
  }
  return parsed.recipes;
}
/** A recipe is an editorial sequence, not an executable package. Exact pinned
 * instructions must still be available in the approved public snapshot. */
export async function recipeReferencesMatch(
  recipe: Recipe,
  specifications: readonly AgentSpecification[],
): Promise<boolean> {
  for (const step of recipe.steps) {
    const spec = specifications.find((item) => item.identity.slug === step.agent_slug);
    if (
      !spec ||
      spec.version !== step.agent_version ||
      (await contentChecksum(spec)) !== step.specification_sha256
    )
      return false;
  }
  return true;
}
export async function availablePublishedRecipes(
  documents: readonly RecipeDocument[],
  resources: readonly PublicResource[],
): Promise<RecipeDocument[]> {
  const specifications = resources.map((resource) => resource.specification);
  const available = await Promise.all(
    documents.map(async (document) =>
      document.publication && (await recipeReferencesMatch(document.recipe, specifications))
        ? document
        : null,
    ),
  );
  return available.filter((document): document is RecipeDocument => document !== null);
}
export const recipePath = (value: string) => `/recipes/${slug.parse(value)}/`;
