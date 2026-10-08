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
  {
    source: 'survey-theme-synthesizer',
    target: 'returns-feedback-analyst',
    capability: 'Traceable feedback themes',
  },
  {
    source: 'interview-guide-designer',
    target: 'research-question-scoper',
    capability: 'Bounded learning questions',
  },
  {
    source: 'launch-message-adapter',
    target: 'campaign-message-planner',
    capability: 'Supported campaign messages',
  },
  {
    source: 'weekly-capacity-planner',
    target: 'calendar-conflict-checker',
    capability: 'Time and commitment constraints',
  },
  {
    source: 'weekly-capacity-planner',
    target: 'household-chore-coordinator',
    capability: 'Capacity allocation',
  },
  {
    source: 'reply-draft-assistant',
    target: 'inbox-priority-triage',
    capability: 'Evidence-backed email actions',
  },
  {
    source: 'study-methods-reader',
    target: 'source-evidence-mapper',
    capability: 'Limits of source evidence',
  },
  {
    source: 'literature-screening-assistant',
    target: 'research-question-scoper',
    capability: 'Explicit research scope',
  },
  {
    source: 'analogy-learning-coach',
    target: 'retrieval-study-coach',
    capability: 'Checking concept understanding',
  },
  {
    source: 'worked-solution-diagnostician',
    target: 'retrieval-study-coach',
    capability: 'Targeted misconception feedback',
  },
  {
    source: 'flashcard-quality-designer',
    target: 'retrieval-study-coach',
    capability: 'Source-grounded retrieval practice',
  },
  {
    source: 'transcript-clip-planner',
    target: 'article-structure-editor',
    capability: 'Preserving source context',
  },
  {
    source: 'plain-language-rewriter',
    target: 'article-structure-editor',
    capability: 'Meaning-preserving editing',
  },
  {
    source: 'alt-text-editor',
    target: 'plain-language-rewriter',
    capability: 'Audience-specific clarity',
  },
  {
    source: 'product-variant-normalizer',
    target: 'product-listing-auditor',
    capability: 'Product attribute consistency',
  },
  {
    source: 'product-faq-grounder',
    target: 'product-listing-auditor',
    capability: 'Source-supported product claims',
  },
  {
    source: 'sop-gap-reviewer',
    target: 'project-dependency-planner',
    capability: 'Missing handoffs and prerequisites',
  },
  {
    source: 'vendor-quote-comparator',
    target: 'weekly-capacity-planner',
    capability: 'Explicit quantitative assumptions',
  },
  {
    source: 'packing-checklist-planner',
    target: 'moving-task-organizer',
    capability: 'Planning from confirmed arrangements',
  },
  {
    source: 'redirect-map-reviewer',
    target: 'search-opportunity-auditor',
    capability: 'Reviewable website audit findings',
  },
  {
    source: 'bug-reproduction-brief',
    target: 'pull-request-reviewer',
    capability: 'Confirmed versus untested code evidence',
  },
];

/** Public links come only from reviewed shared tags. No activity or similarity
 * score is manufactured. A sparse bounded graph keeps large inputs economical.
 * Local curated draft links are never carried into a changed public version.
 */
export function universeRelations(resources: readonly DiscoveryResource[]): UniverseRelation[] {
  if (resources.every((resource) => resource.state === 'draft')) {
    const slugs = new Set(resources.map((resource) => resource.slug));
    return draftRelations.filter((edge) => slugs.has(edge.source) && slugs.has(edge.target));
  }
  const seen = new Map<string, string[]>();
  const pairs = new Set<string>();
  const edges: UniverseRelation[] = [];
  for (const resource of resources.slice(0, 1000)) {
    for (const tag of resource.connectionTags.slice(0, 8)) {
      const peers = seen.get(tag) ?? [];
      for (const peer of peers.slice(-3)) {
        const pair = [peer, resource.slug].sort().join(':');
        if (pairs.has(pair)) continue;
        pairs.add(pair);
        edges.push({ source: peer, target: resource.slug, capability: tag.replaceAll('-', ' ') });
        if (edges.length === 1200) return edges;
      }
      seen.set(tag, [...peers.slice(-2), resource.slug]);
    }
  }
  return edges;
}

const desktopPositions = [
  [330, 245],
  [110, 85],
  [330, 65],
  [550, 90],
  [110, 260],
  [550, 260],
  [110, 435],
  [330, 445],
  [550, 435],
] as const;
const compactPositions = [
  [180, 205],
  [90, 75],
  [275, 80],
  [180, 345],
] as const;

/** Two bounded lines, with the full name retained in the accessible link. */
export function universeLabel(title: string, compact: boolean): string[] {
  const width = compact ? 16 : 22;
  const words = title.trim().split(/\s+/);
  const lines: string[] = [];
  let remaining = words.join(' ');
  for (let row = 0; row < 2 && remaining; row++) {
    if (remaining.length <= width) {
      lines.push(remaining);
      break;
    }
    if (row === 1) {
      lines.push(remaining.slice(0, width - 1).trimEnd() + '…');
      break;
    }
    const boundary = remaining.lastIndexOf(' ', width);
    const cut = boundary > 0 ? boundary : width;
    lines.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }
  return lines;
}

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
  const candidates = [
    ...(selected ? [selected] : []),
    ...resources.filter(
      (item) => item.slug !== selectedSlug && matchSet.has(item.slug) && neighbors.has(item.slug),
    ),
    ...(compact
      ? []
      : resources.filter(
          (item) =>
            item.slug !== selectedSlug && matchSet.has(item.slug) && !neighbors.has(item.slug),
        )),
  ].slice(0, compact ? 4 : 9);
  const positions = compact ? compactPositions : desktopPositions;
  const nodes = candidates.map((resource, index) => {
    const position = positions[index];
    if (!position) throw new Error('Universe layout capacity exceeded.');
    return {
      resource,
      x: Number(position[0]),
      y: Number(position[1]),
      label: resource.title,
      labelLines: universeLabel(resource.title, compact),
      matched: true,
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
