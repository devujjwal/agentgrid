import type { MetadataRoute } from 'next';
import { reviewedEditorialPaths } from '../domain/editorial-discovery';
import { publicRecipes } from '../data/recipes';
import { recipePath } from '../domain/recipe';
import { publicResources } from '../data/resources';
import { resourcePath } from '../domain/public-resource';

export const dynamic = 'force-static';

/** Explicit published resources only. No drafts, local QA, search queries,
 * meaningless filters or fabricated modification dates enter the sitemap.
 * Discovery/editorial landing URLs join this list at their own indexing gate.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    ...(process.env.AGENTGRID_BUILD_STAGE === 'production' ? reviewedEditorialPaths : []).map(
      (path) => ({ url: `https://agentgrid.me${path}` }),
    ),
    ...publicResources().map((resource) => ({
      url: `https://agentgrid.me${resourcePath(resource.specification.identity.slug)}`,
      lastModified: resource.released_at,
    })),
    ...(await publicRecipes()).map(({ recipe, publication }) => ({
      url: `https://agentgrid.me${recipePath(recipe.slug)}`,
      lastModified: publication!.released_at,
    })),
  ];
}
