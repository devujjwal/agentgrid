import type { MetadataRoute } from 'next';
import { directoryPages, directoryPagePath } from '../domain/directory-pagination';
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
  if (process.env.AGENTGRID_BUILD_STAGE !== 'production') return [];
  const resources = publicResources();
  return [
    ...reviewedEditorialPaths.map((path) => ({ url: `https://agentgrid.me${path}` })),
    ...directoryPages(resources.length).map((page) => ({
      url: `https://agentgrid.me${directoryPagePath(page)}`,
    })),
    ...resources.map((resource) => ({
      url: `https://agentgrid.me${resourcePath(resource.specification.identity.slug)}`,
      lastModified: resource.released_at,
    })),
    ...(await publicRecipes()).map(({ recipe, publication }) => ({
      url: `https://agentgrid.me${recipePath(recipe.slug)}`,
      lastModified: publication!.released_at,
    })),
  ];
}
