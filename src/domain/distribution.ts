import type { AgentSpecification } from './agent-specification.ts';
import type { PublicResource } from './public-resource.ts';

export function distributionPolicy(
  spec: AgentSpecification,
  published: boolean,
  platformSlug?: string,
) {
  const usable =
    published && spec.license.identifier !== 'unselected' && spec.license.permissions.use;
  return {
    usable,
    canCopy:
      usable &&
      spec.platforms.some(
        (platform) =>
          platform.distribution === 'instructions' &&
          (!platformSlug || platform.slug === platformSlug),
      ),
    canExport: usable && spec.license.permissions.redistribute,
    canPublicFork: usable && spec.license.permissions.public_fork,
    reason: !published
      ? 'This draft has not been published.'
      : !usable
        ? 'Reuse permission is unavailable.'
        : null,
  };
}

export function instructionText(
  spec: AgentSpecification,
  published: boolean,
  platformSlug?: string,
): string {
  if (!distributionPolicy(spec, published, platformSlug).canCopy)
    throw new Error('Instruction distribution is unavailable.');
  return spec.execution.instructions;
}

/** Copy preserves the exact instructions and carries their provenance/terms.
 * A clipboard transfer must not silently discard a creator's attribution.
 */
export function attributedInstructionText(resource: PublicResource, platformSlug: string): string {
  const spec = resource.specification;
  const lines = [
    instructionText(spec, true, platformSlug),
    '',
    '---',
    'Resource provenance and reuse terms',
    `${spec.identity.name} · version ${spec.version}`,
    `Creator: ${resource.creator.name}`,
    `Source: https://agentgrid.me/agents/${spec.identity.slug}/`,
    `License: ${spec.license.identifier}`,
    spec.license.statement,
    ...(spec.license.url ? [`License details: ${spec.license.url}`] : []),
    ...resource.lineage.map(
      (source) =>
        `Based on: ${source.source_slug} ${source.source_version}, by ${source.creator_name}`,
    ),
  ];
  return lines.join('\n');
}

/** Portable definition plus explicit attribution. The application license is
 * never substituted for the creator's package license. No private fields or
 * provider tokens enter this downloadable envelope.
 */
export function resourcePackage(resource: PublicResource) {
  const spec = resource.specification;
  if (!distributionPolicy(spec, true).canExport)
    throw new Error('Package redistribution is unavailable.');
  return {
    package_format: 'agentgrid-resource/0.1',
    specification: spec,
    attribution: {
      source_url: `https://agentgrid.me/agents/${spec.identity.slug}/`,
      creator: resource.creator.name,
      version: spec.version,
      released_at: resource.released_at,
      lineage: resource.lineage,
    },
  };
}
