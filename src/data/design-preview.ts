/** Server-only local design fixtures. Never a publication allowlist. */
import 'server-only';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DiscoveryResource } from '../domain/discovery';
import { parseAgentSpecification } from '../domain/agent-specification';

import { discoveryKeywords } from './discovery-metadata';

export function localDesignCatalogue(): DiscoveryResource[] {
  if (process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1') return [];
  if (process.env.CI || process.env.GITHUB_ACTIONS)
    throw new Error('Draft design fixtures are local-only.');
  const root = resolve('content/agents');
  return readdirSync(root).map((slug) => {
    const agent = parseAgentSpecification(
      JSON.parse(readFileSync(resolve(root, slug, '1.0.0.agent.json'), 'utf8')),
    );
    return {
      slug: agent.identity.slug,
      kind: 'agent',
      title: agent.identity.name,
      summary: agent.identity.summary,
      category: agent.category,
      capabilities: agent.capabilities.map((item) => item.name),
      keywords: discoveryKeywords[slug] ?? [],
      platforms: agent.platforms.map((item) => item.slug),
      href: '#resource-inspector',
    };
  });
}
