/** Public discovery DTO. No instructions, drafts, Auth IDs or private evidence. */
export interface DiscoveryResource {
  slug: string;
  kind: 'agent' | 'recipe' | 'category' | 'integration';
  title: string;
  summary: string;
  category: string;
  capabilities: readonly string[];
  keywords: readonly string[];
  platforms: readonly string[];
  href: string;
}

export interface DiscoveryQuery {
  text: string;
  category?: string;
  kinds?: readonly DiscoveryResource['kind'][];
  limit?: number;
}

export interface DiscoveryMatch {
  resource: DiscoveryResource;
  matchedTerms: readonly string[];
  score: number;
}

export interface SearchProvider {
  search(query: DiscoveryQuery): Promise<readonly DiscoveryMatch[]>;
}

const IGNORE = new Set([
  'a',
  'an',
  'the',
  'to',
  'for',
  'my',
  'me',
  'that',
  'can',
  'agent',
  'ai',
  'find',
  'with',
  'and',
  'i',
  'want',
  'help',
]);
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();

/** Literal zero-cost ranking. Curated keywords describe capabilities, never new tools. */
export function searchCatalogue(
  resources: readonly DiscoveryResource[],
  query: DiscoveryQuery,
): DiscoveryMatch[] {
  const terms = [
    ...new Set(
      (normalize(query.text.slice(0, 200)).match(/[\p{L}\p{N}]+/gu) ?? []).map((term) =>
        term.length > 4 && term.endsWith('s') && !term.endsWith('ss') ? term.slice(0, -1) : term,
      ),
    ),
  ].filter((term) => !IGNORE.has(term));
  const limit = Math.max(1, Math.min(60, Math.trunc(query.limit ?? 30) || 30));
  return resources
    .slice(0, 10_000)
    .flatMap((resource) => {
      if (
        (query.category && resource.category !== query.category) ||
        (query.kinds && !query.kinds.includes(resource.kind))
      )
        return [];
      const title = normalize(resource.title);
      const keywords = normalize(resource.keywords.join(' '));
      const body = normalize(
        [resource.summary, resource.category, ...resource.capabilities, ...resource.platforms].join(
          ' ',
        ),
      );
      const matchedTerms = terms.filter((term) => `${title} ${keywords} ${body}`.includes(term));
      // A broad verb alone must not surface an unrelated task when the query
      // also names a specific discipline. Keep ranking explanatory and bounded.
      if (terms.length && matchedTerms.length < Math.ceil(terms.length * 0.6)) return [];
      const score =
        matchedTerms.reduce(
          (total, term) => total + (title.includes(term) ? 5 : keywords.includes(term) ? 3 : 1),
          0,
        ) + (matchedTerms.length === terms.length && terms.length ? 8 : 0);
      return [{ resource, matchedTerms, score }];
    })
    .sort((a, b) => b.score - a.score || a.resource.title.localeCompare(b.resource.title, 'en'))
    .slice(0, limit);
}

export function createCatalogueSearch(resources: readonly DiscoveryResource[]): SearchProvider {
  return { search: async (query) => searchCatalogue(resources, query) };
}
