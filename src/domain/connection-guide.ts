import { z } from 'zod';
import { assertJsonDocumentBounds, type AgentSpecification } from './agent-specification.ts';
import { hasCredentialSignature } from './public-content.ts';
import type { DiscoveryResource } from './discovery.ts';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const kind = z.enum(['platform', 'integration', 'mcp']);
const sourceHosts = new Set([
  'learn.chatgpt.com',
  'developers.openai.com',
  'support.claude.com',
  'support.google.com',
  'docs.github.com',
  'modelcontextprotocol.io',
]);
const schema = z.strictObject({
  kind,
  slug,
  name: text(3, 100),
  summary: text(60, 260),
  checked_on: z.iso.date(),
  review_after: z.iso.date(),
  sections: z
    .array(z.strictObject({ title: text(10, 120), body: text(100, 1200) }))
    .min(3)
    .max(8),
  checklist: z.array(text(50, 400)).min(3).max(8),
  sources: z
    .array(
      z.strictObject({
        title: text(8, 160),
        url: z.url().refine((value) => {
          const url = new URL(value);
          return (
            url.protocol === 'https:' &&
            !url.username &&
            !url.password &&
            !url.port &&
            sourceHosts.has(url.hostname)
          );
        }),
      }),
    )
    .min(1)
    .max(6),
  categories: z.array(slug).min(1).max(4),
});
export type ConnectionGuide = z.infer<typeof schema>;
export type ConnectionKind = ConnectionGuide['kind'];
export function parseConnectionGuides(
  input: unknown,
  categorySlugs: readonly string[],
  now = new Date(),
): ConnectionGuide[] {
  assertJsonDocumentBounds(input);
  if (hasCredentialSignature(input))
    throw new Error('Potential credential in connection guidance.');
  const guides = z.array(schema).min(1).max(100).parse(input);
  if (new Set(guides.map((item) => item.kind + ':' + item.slug)).size !== guides.length)
    throw new Error('Duplicate connection route.');
  for (const item of guides) {
    if (
      item.categories.some((value) => !categorySlugs.includes(value)) ||
      new Set(item.categories).size !== item.categories.length
    )
      throw new Error('Unknown or duplicate related category.');
    if (
      Date.parse(item.checked_on + 'T00:00:00Z') > now.getTime() ||
      item.review_after <= item.checked_on
    )
      throw new Error('Invalid guidance review dates.');
  }
  return guides;
}
export const connectionSection = (value: ConnectionKind) =>
  value === 'platform' ? 'platforms' : value === 'integration' ? 'integrations' : 'mcp';
export const connectionPath = (item: Pick<ConnectionGuide, 'kind' | 'slug'>) =>
  `/${connectionSection(kind.parse(item.kind))}/${slug.parse(item.slug)}/`;
export const needsConnectionReview = (item: ConnectionGuide, now = new Date()) =>
  now.getTime() >= Date.parse(item.review_after + 'T00:00:00Z');
/** Labels describe declared requirements only. Publication and actual host
 * verification are enforced separately by the public-resource loader. */
export function declaresConnection(spec: AgentSpecification, guide: ConnectionGuide): boolean {
  if (guide.kind === 'platform') return spec.platforms.some((item) => item.slug === guide.slug);
  if (guide.kind === 'integration')
    return spec.tools.some((item) => item.kind === 'integration' && item.id === guide.slug);
  return false; // Protocol explanation is not a server identity.
}
export function integrationDiscovery(guides: readonly ConnectionGuide[]): DiscoveryResource[] {
  return guides
    .filter((item) => item.kind === 'integration')
    .map((item) => ({
      slug: `integration:${item.slug}`,
      kind: 'integration',
      title: `${item.name}: prepare a useful handoff`,
      summary: item.summary,
      category: item.categories[0]!,
      capabilities: item.sections.slice(0, 2).map((section) => section.title),
      keywords: [item.name, item.slug, ...item.categories],
      connectionTags: [],
      platforms: [],
      href: connectionPath(item),
      state: 'editorial',
      creatorName: 'AgentGrid Editorial',
      format: 'guide',
    }));
}
