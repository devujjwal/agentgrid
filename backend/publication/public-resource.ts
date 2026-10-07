import { z } from 'zod';
import { EditorialSchema, PublicEditorialSchema } from '../../src/domain/editorial.ts';
import { parsePublicResource } from '../../src/domain/public-resource.ts';
import { parseAgentSpecification } from '../../src/domain/agent-specification.ts';
import { hasCredentialSignature } from '../security/public-content.ts';

const ReleasedRowSchema = z.strictObject({
  agent_id: z.uuid(),
  slug: z.string(),
  version_id: z.uuid(),
  version: z.string(),
  specification: z.unknown(),
  editorial: z.unknown(),
  released_at: z.iso.datetime({ offset: true }),
  creator_name: z.string(),
  creator_username: z.string().nullable(),
  creator_kind: z.enum(['first-party', 'community']),
});
const LineageRowSchema = z.strictObject({
  depth: z.number().int().min(1).max(32),
  source_agent_id: z.uuid(),
  source_version_id: z.uuid(),
  source_slug: z.string(),
  source_version: z.string(),
  creator_name: z.string(),
  source_available: z.boolean(),
});

/** Input must come from agentgrid_public_resource / agentgrid_public_lineage.
 * Those database projections enforce current publication visibility. Never feed
 * a submission, a working draft, or browser-supplied publication claims here.
 * This function projects the approved data; it does not approve a release.
 */
export function projectReleasedResource(value: unknown, lineageRows: unknown[]) {
  const row = ReleasedRowSchema.parse(value);
  const specification = parseAgentSpecification(row.specification);
  const editorial = EditorialSchema.parse(row.editorial);
  if (row.slug !== specification.identity.slug || row.version !== specification.version)
    throw new Error('Published identity does not match the immutable package.');
  if (hasCredentialSignature(specification) || hasCredentialSignature(editorial))
    throw new Error('Potential credential in public release.');
  if (!Array.isArray(lineageRows) || lineageRows.length > 32)
    throw new Error('Bounded public lineage required.');
  const lineage = lineageRows.map((item, index) => {
    const record = LineageRowSchema.parse(item);
    if (record.depth !== index + 1)
      throw new Error('Public lineage must be ordered and contiguous.');
    return {
      source_slug: record.source_slug,
      source_version: record.source_version,
      creator_name: record.creator_name,
      source_available: record.source_available,
    };
  });
  const publicEditorial = {
    overview: editorial.overview,
    audience: editorial.audience,
    workflow: editorial.workflow,
    faq: editorial.faq,
    sources: editorial.sources,
    related_agent_slugs: editorial.related_agent_slugs,
    reviewed_on: editorial.reviewed_on,
    ...(editorial.discovery ? { discovery: editorial.discovery } : {}),
  };
  // Explicit parsing keeps the public shape closed even when editorial evolves.
  return parsePublicResource({
    resource_id: row.agent_id,
    version_id: row.version_id,
    released_at: row.released_at,
    specification,
    editorial: PublicEditorialSchema.parse(publicEditorial),
    creator: { name: row.creator_name, username: row.creator_username, kind: row.creator_kind },
    lineage,
  });
}
