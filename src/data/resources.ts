import 'server-only';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseCatalogue } from '../domain/publication-snapshot';
import type { AgentSpecification } from '../domain/agent-specification';
import { type PublicResource } from '../domain/public-resource';
import type { DiscoveryResource } from '../domain/discovery';
import { localDesignSpecifications } from './design-preview';
import { discoveryKeywords } from './discovery-metadata';

export interface ResourceDocument {
  specification: AgentSpecification;
  publication: PublicResource | null;
}

/** Only the explicit public projection is a production build input. Never query
 * the shared database, working drafts, private evidence or privileged keys here.
 */
export function publicResources(): PublicResource[] {
  const path = resolve('content/publication/catalogue.json');
  const bytes = readFileSync(path);
  if (bytes.byteLength > 32_000_000) throw new Error('Public catalogue exceeds build bounds.');
  return parseCatalogue(JSON.parse(bytes.toString('utf8'))).resources;
}

export function resourceDocuments(): ResourceDocument[] {
  if (process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1')
    return localDesignSpecifications().map((specification) => ({
      specification,
      publication: null,
    }));
  return publicResources().map((publication) => ({
    specification: publication.specification,
    publication,
  }));
}

export function discoveryResources(documents = resourceDocuments()): DiscoveryResource[] {
  return documents.map(({ specification: spec, publication }) => ({
    slug: spec.identity.slug,
    kind: 'agent',
    title: spec.identity.name,
    summary: spec.identity.summary,
    category: spec.category,
    capabilities: spec.capabilities.map((item) => item.name),
    keywords: publication
      ? (publication.editorial.discovery?.keywords ?? [])
      : (discoveryKeywords[spec.identity.slug] ?? []),
    connectionTags: publication?.editorial.discovery?.capability_tags ?? [],
    platforms: spec.platforms.map((item) => item.slug),
    href: `/agents/${spec.identity.slug}/`,
    state: publication ? 'published' : 'draft',
    creatorName: publication?.creator.name ?? 'AgentGrid Editorial draft',
    format: spec.execution.mode === 'interactive' ? 'instructions' : 'workflow',
  }));
}
