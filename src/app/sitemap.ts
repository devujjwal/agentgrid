import type { MetadataRoute } from 'next';
import { publicResources } from '../data/resources';
import { resourcePath } from '../domain/public-resource';

export const dynamic = 'force-static';

/** Explicit published resources only. No drafts, local QA, search queries,
 * meaningless filters or fabricated modification dates enter the sitemap.
 * Discovery/editorial landing URLs join this list at their own indexing gate.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return publicResources().map((resource) => ({
    url: `https://agentgrid.me${resourcePath(resource.specification.identity.slug)}`,
    lastModified: resource.released_at,
  }));
}
