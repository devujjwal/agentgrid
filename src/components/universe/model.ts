import type { DiscoveryResource } from '../../domain/discovery';

export interface UniverseRelation {
  source: string;
  target: string;
  capability: string;
}
export const draftRelations: readonly UniverseRelation[] = [
  { source: 'campaign-message-planner', target: 'article-structure-editor', capability: 'Writing' },
  {
    source: 'campaign-message-planner',
    target: 'product-listing-auditor',
    capability: 'Supported claims',
  },
  {
    source: 'source-evidence-mapper',
    target: 'article-structure-editor',
    capability: 'Source evidence',
  },
  {
    source: 'source-evidence-mapper',
    target: 'retrieval-study-coach',
    capability: 'Supplied source material',
  },
  {
    source: 'source-evidence-mapper',
    target: 'search-opportunity-auditor',
    capability: 'Evidence analysis',
  },
  {
    source: 'inbox-priority-triage',
    target: 'meeting-decision-ledger',
    capability: 'Actions and deadlines',
  },
  {
    source: 'meeting-decision-ledger',
    target: 'source-evidence-mapper',
    capability: 'Traceable source evidence',
  },
  {
    source: 'product-listing-auditor',
    target: 'pull-request-reviewer',
    capability: 'Auditing supplied material',
  },
  {
    source: 'household-meal-planner',
    target: 'campaign-message-planner',
    capability: 'Planning under constraints',
  },
  {
    source: 'pull-request-reviewer',
    target: 'source-evidence-mapper',
    capability: 'Evidence-linked findings',
  },
];

const curated: Record<string, [number, number, string]> = {
  'campaign-message-planner': [165, 100, 'Message planner'],
  'inbox-priority-triage': [100, 270, 'Inbox triage'],
  'source-evidence-mapper': [340, 215, 'Evidence mapper'],
  'retrieval-study-coach': [515, 100, 'Study coach'],
  'article-structure-editor': [335, 65, 'Article editor'],
  'product-listing-auditor': [555, 285, 'Listing auditor'],
  'meeting-decision-ledger': [265, 350, 'Decision ledger'],
  'household-meal-planner': [445, 410, 'Meal planner'],
  'search-opportunity-auditor': [135, 435, 'Search auditor'],
  'pull-request-reviewer': [515, 480, 'PR reviewer'],
};
const compactPositions = [
  [180, 200],
  [80, 80],
  [285, 85],
  [180, 345],
] as const;

/** Bounded layout keeps the list authoritative; the map is always a selected subset. */
export function layoutUniverse(
  resources: readonly DiscoveryResource[],
  relations: readonly UniverseRelation[],
  matches: readonly string[],
  selectedSlug: string,
  compact: boolean,
) {
  const matchSet = new Set(matches);
  const neighbors = new Set(
    relations
      .filter((edge) => edge.source === selectedSlug || edge.target === selectedSlug)
      .flatMap((edge) => [edge.source, edge.target]),
  );
  const selected = resources.find((item) => item.slug === selectedSlug && matchSet.has(item.slug));
  const candidates = compact
    ? [
        ...(selected ? [selected] : []),
        ...resources.filter(
          (item) =>
            item.slug !== selectedSlug && matchSet.has(item.slug) && neighbors.has(item.slug),
        ),
      ].slice(0, 4)
    : [
        ...(selected ? [selected] : []),
        ...resources.filter((item) => item.slug !== selectedSlug && matchSet.has(item.slug)),
        ...resources.filter((item) => !matchSet.has(item.slug)),
      ].slice(0, 24);
  const filtered = matches.length < resources.length;
  const nodes = candidates.map((resource, index) => {
    const original = curated[resource.slug] ?? [
      60 + (index % 6) * 105,
      70 + Math.floor(index / 6) * 125,
      resource.title.slice(0, 24),
    ];
    const matchedIndex = matches.indexOf(resource.slug);
    const angle = (matchedIndex / Math.max(matches.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const position = compact
      ? (compactPositions[index] ?? compactPositions[0])
      : filtered && matchedIndex >= 0
        ? [
            330 + (matches.length === 1 ? 0 : Math.cos(angle) * 180),
            245 + (matches.length === 1 ? 0 : Math.sin(angle) * 150),
          ]
        : original;
    return {
      resource,
      x: Number(position[0]),
      y: Number(position[1]),
      label: String(original[2]),
      matched: matchSet.has(resource.slug),
      related: neighbors.has(resource.slug),
    };
  });
  const included = new Set(nodes.map((node) => node.resource.slug));
  return {
    nodes,
    edges: relations.filter((edge) => included.has(edge.source) && included.has(edge.target)),
    compact,
    matchedCount: matches.length,
  };
}
