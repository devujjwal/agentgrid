/** Public discovery DTO. No instructions, drafts, Auth IDs or private evidence. */
export interface DiscoveryResource {
  slug: string;
  kind: 'agent' | 'recipe' | 'category' | 'integration';
  title: string;
  summary: string;
  category: string;
  capabilities: readonly string[];
  keywords: readonly string[];
  connectionTags: readonly string[];
  platforms: readonly string[];
  href: string;
  state: 'draft' | 'published';
  creatorName: string;
  format: 'instructions' | 'workflow' | 'recipe';
}

export interface DiscoveryQuery {
  text: string;
  category?: string;
  kinds?: readonly DiscoveryResource['kind'][];
  limit?: number;
  offset?: number;
}

export interface DiscoveryMatch {
  resource: DiscoveryResource;
  matchedTerms: readonly string[];
  score: number;
}

export interface SearchProvider {
  readonly initialPage: DiscoveryPage;
  search(query: DiscoveryQuery, signal?: AbortSignal): Promise<DiscoveryPage>;
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
  'of',
  'from',
  'in',
  'into',
  'on',
  'at',
  'is',
  'are',
  'do',
  'does',
  'this',
  'it',
  'what',
  'which',
  'please',
  'have',
  'has',
  'already',
  'actually',
]);
const normalize = (text: string) => text.normalize('NFKC').toLowerCase();
const stem = (term: string) => {
  if (term === 'prs') return 'pr';
  if (term === 'summarise') return 'summarize';
  if (term.length > 4 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1);
  return term;
};
const tokens = (text: string) =>
  new Set((normalize(text).match(/[\p{L}\p{N}]+/gu) ?? []).map(stem));

export interface DiscoveryPage {
  matches: readonly DiscoveryMatch[];
  total: number;
  offset: number;
  limit: number;
}

/** Literal zero-cost ranking. Token matching avoids “PR” matching “priority”.
 * Curated aliases describe real capabilities, never invented integrations.
 */
export function searchCataloguePage(
  resources: readonly DiscoveryResource[],
  query: DiscoveryQuery,
): DiscoveryPage {
  const terms = [...tokens(query.text.slice(0, 200))].filter((term) => !IGNORE.has(term));
  const limit = Math.max(1, Math.min(60, Math.trunc(query.limit ?? 30) || 30));
  const offset = Math.max(0, Math.min(9999, Math.trunc(query.offset ?? 0) || 0));
  const ranked = resources
    .slice(0, 10_000)
    .flatMap((resource) => {
      if (
        (query.category && resource.category !== query.category) ||
        (query.kinds && !query.kinds.includes(resource.kind))
      )
        return [];
      const title = tokens(resource.title);
      const keywords = tokens(resource.keywords.join(' '));
      const body = tokens(
        [resource.summary, resource.category, ...resource.capabilities, ...resource.platforms].join(
          ' ',
        ),
      );
      const matchedTerms = terms.filter(
        (term) => title.has(term) || keywords.has(term) || body.has(term),
      );
      // Specific discipline words must accompany a broad verb in multi-term tasks.
      if (terms.length && matchedTerms.length < Math.ceil(terms.length * 0.6)) return [];
      const score =
        matchedTerms.reduce(
          (total, term) => total + (title.has(term) ? 5 : keywords.has(term) ? 3 : 1),
          0,
        ) + (matchedTerms.length === terms.length && terms.length ? 8 : 0);
      return [{ resource, matchedTerms, score }];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.resource.title.localeCompare(b.resource.title, 'en') ||
        a.resource.slug.localeCompare(b.resource.slug, 'en'),
    );
  return { matches: ranked.slice(offset, offset + limit), total: ranked.length, offset, limit };
}

export function searchCatalogue(
  resources: readonly DiscoveryResource[],
  query: DiscoveryQuery,
): DiscoveryMatch[] {
  return [...searchCataloguePage(resources, query).matches];
}
export function createCatalogueSearch(resources: readonly DiscoveryResource[]): SearchProvider {
  return {
    initialPage: searchCataloguePage(resources, { text: '' }),
    search: async (query, signal) => {
      signal?.throwIfAborted();
      return searchCataloguePage(resources, query);
    },
  };
}
