import { z } from 'zod';
import { assertJsonDocumentBounds } from './agent-specification.ts';
import { hasCredentialSignature } from './public-content.ts';
import type { DiscoveryResource } from './discovery.ts';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const category = z.strictObject({
  slug,
  name: text(2, 60),
  headline: text(15, 100),
  summary: text(60, 260),
  overview: text(300, 1800),
  inputs: z.array(text(60, 400)).min(2).max(6),
  choices: z
    .array(z.strictObject({ title: text(10, 100), body: text(80, 600) }))
    .min(2)
    .max(5),
  check: text(100, 700),
  stop: text(100, 700),
  keywords: z.array(text(2, 80)).min(3).max(20),
  related: z.array(slug).min(1).max(4),
  updated: z.iso.date(),
});
export type CategoryGuide = z.infer<typeof category>;
export function parseCategoryGuides(input: unknown, now = new Date()): CategoryGuide[] {
  assertJsonDocumentBounds(input);
  if (hasCredentialSignature(input)) throw new Error('Potential credential in category content.');
  const guides = z.array(category).min(1).max(50).parse(input);
  const slugs = new Set(guides.map((item) => item.slug));
  if (slugs.size !== guides.length) throw new Error('Duplicate category route.');
  for (const item of guides) {
    if (
      item.related.some((id) => !slugs.has(id) || id === item.slug) ||
      new Set(item.related).size !== item.related.length
    )
      throw new Error('Invalid category relation.');
    if (Date.parse(item.updated + 'T00:00:00Z') > now.getTime())
      throw new Error('Future category review.');
  }
  return guides;
}
export const categoryPath = (value: string) => `/categories/${slug.parse(value)}/`;
export function categoryDiscovery(guides: readonly CategoryGuide[]): DiscoveryResource[] {
  return guides.map((item) => ({
    slug: `category:${item.slug}`,
    kind: 'category',
    title: `${item.name}: ${item.headline}`,
    summary: item.summary,
    category: item.slug,
    capabilities: item.choices.map((choice) => choice.title),
    keywords: item.keywords,
    platforms: [],
    connectionTags: [],
    href: categoryPath(item.slug),
    state: 'editorial',
    creatorName: 'AgentGrid Editorial',
    format: 'guide',
  }));
}
