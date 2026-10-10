import { z } from 'zod';
import { hasCredentialSignature } from './public-content.ts';
import { AgentSpecificationSchema, assertJsonDocumentBounds } from './agent-specification.ts';
import { PublicEditorialSchema } from './editorial.ts';

/** Published application metadata is separate from the portable agent package. */
export const PublicResourceSchema = z
  .strictObject({
    resource_id: z.uuid(),
    version_id: z.uuid(),
    released_at: z.iso.datetime({ offset: true }),
    specification: AgentSpecificationSchema,
    editorial: PublicEditorialSchema,
    creator: z.strictObject({
      name: z.string().trim().min(1).max(100),
      username: z
        .string()
        .regex(/^[a-z][a-z0-9_]{2,29}$/)
        .nullable(),
      kind: z.enum(['first-party', 'community']),
    }),
    lineage: z
      .array(
        z.strictObject({
          source_slug: z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(80),
          source_version: z
            .string()
            .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
            .max(24),
          creator_name: z.string().trim().min(1).max(100),
          source_available: z.boolean(),
        }),
      )
      .max(32),
  })
  .superRefine((resource, context) => {
    if (
      resource.specification.license.identifier === 'unselected' ||
      !resource.specification.license.permissions.use
    )
      context.addIssue({ code: 'custom', message: 'Unlicensed drafts are not public resources.' });
    if (
      resource.specification.execution.artifact_path ||
      resource.specification.platforms.some((platform) => platform.distribution !== 'instructions')
    )
      context.addIssue({
        code: 'custom',
        message: 'Workflow publishing requires validated artifact delivery support.',
      });
    if (resource.creator.kind === 'first-party' && resource.creator.name !== 'AgentGrid Editorial')
      context.addIssue({ code: 'custom', message: 'First-party attribution must be explicit.' });
    if (Date.parse(resource.editorial.reviewed_on) > Date.parse(resource.released_at))
      context.addIssue({ code: 'custom', message: 'Editorial review cannot postdate release.' });
  });
export type PublicResource = z.infer<typeof PublicResourceSchema>;

/** Strict allowlist projection: private evidence, Auth IDs and live counters have no fields. */
export function parsePublicResource(value: unknown): PublicResource {
  assertJsonDocumentBounds(value);
  if (hasCredentialSignature(value)) throw new Error('Potential credential in public content.');
  return PublicResourceSchema.parse(value);
}

export function resourcePath(slug: string): string {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80)
    throw new Error('Invalid resource slug.');
  return `/agents/${slug}/`;
}

export function serializeStructuredData(value: unknown): string {
  // JSON is text inside a script element, not raw HTML. Escape script delimiters.
  return JSON.stringify(value).replace(
    /[<>&\u2028\u2029]/g,
    (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
}

export function resourceStructuredData(resource: PublicResource) {
  const spec = resource.specification;
  const url = `https://agentgrid.me${resourcePath(spec.identity.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CreativeWork',
        '@id': `${url}#resource`,
        url,
        name: spec.identity.name,
        abstract: spec.identity.summary,
        description: resource.editorial.overview,
        version: spec.version,
        mainEntityOfPage: url,
        isAccessibleForFree: true,
        genre: 'Interactive instruction package',
        ...(resource.editorial.discovery
          ? { keywords: resource.editorial.discovery.keywords.join(', ') }
          : {}),
        about: spec.capabilities.map((capability) => ({
          '@type': 'DefinedTerm',
          name: capability.name,
          description: capability.description,
        })),
        citation: resource.editorial.sources.map((source) => ({
          '@type': 'CreativeWork',
          name: source.title,
          url: source.url,
          description: source.supports,
        })),
        isPartOf: {
          '@type': 'CollectionPage',
          url: `https://agentgrid.me/categories/${spec.category}/`,
        },
        ...(resource.lineage.length
          ? {
              isBasedOn: resource.lineage.map((source) => ({
                '@type': 'CreativeWork',
                name: source.source_slug,
                version: source.source_version,
                ...(source.source_available
                  ? { url: `https://agentgrid.me/agents/${source.source_slug}/` }
                  : {}),
              })),
            }
          : {}),
        dateModified: resource.released_at,
        inLanguage: 'en',
        ...(spec.license.url ? { license: spec.license.url } : {}),
        creator: {
          '@type': resource.creator.kind === 'first-party' ? 'Organization' : 'Person',
          name: resource.creator.name,
          ...(resource.creator.username
            ? { url: `https://agentgrid.me/creators/${resource.creator.username}/` }
            : {}),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AgentGrid', item: 'https://agentgrid.me/' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Agents',
            item: 'https://agentgrid.me/agents/',
          },
          { '@type': 'ListItem', position: 3, name: spec.identity.name, item: url },
        ],
      },
    ],
  };
}
