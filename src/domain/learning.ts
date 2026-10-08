import { z } from 'zod';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const source = z.strictObject({
  id: slug,
  title: text(5, 160),
  checked: z.iso.date(),
  url: z.url().refine((value) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  }),
});
const guide = z.strictObject({
  slug,
  title: text(15, 120),
  summary: text(60, 240),
  intent: text(40, 300),
  updated: z.iso.date(),
  sections: z
    .array(
      z.strictObject({
        id: slug,
        title: text(10, 120),
        paragraphs: z.array(text(60, 1600)).min(1).max(6),
        sourceIds: z.array(slug).max(5).optional(),
      }),
    )
    .min(3)
    .max(12),
  worksheet: z.strictObject({ title: text(5, 100), text: text(80, 2000) }),
  related: z.array(slug).min(1).max(4),
  sources: z.array(source).max(12),
});
export type LearningGuide = z.infer<typeof guide>;
export function parseLearningGuides(input: unknown, now = new Date()): LearningGuide[] {
  const guides = z.array(guide).min(1).max(100).parse(input);
  const slugs = new Set(guides.map((item) => item.slug));
  if (slugs.size !== guides.length) throw new Error('Duplicate learning route.');
  for (const item of guides) {
    const ids = [...item.sections.map((section) => section.id), 'worksheet', 'sources', 'related'];
    if (new Set(ids).size !== ids.length) throw new Error('Duplicate guide section.');
    const sourceIds = new Set(item.sources.map((entry) => entry.id));
    if (sourceIds.size !== item.sources.length) throw new Error('Duplicate source identifier.');
    if (item.sections.some((section) => section.sourceIds?.some((id) => !sourceIds.has(id))))
      throw new Error('Missing guide source.');
    if (
      new Set(item.related).size !== item.related.length ||
      item.related.some((id) => id === item.slug || !slugs.has(id))
    )
      throw new Error('Invalid related guide.');
    if (
      [item.updated, ...item.sources.map((entry) => entry.checked)].some(
        (date) => Date.parse(date + 'T00:00:00Z') > now.getTime(),
      )
    )
      throw new Error('Future editorial review.');
  }
  return guides;
}
export const learningPath = (value: string) => `/learn/${slug.parse(value)}/`;
export function learningStructuredData(item: LearningGuide) {
  const url = `https://agentgrid.me${learningPath(item.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        url,
        mainEntityOfPage: url,
        headline: item.title,
        description: item.summary,
        dateModified: item.updated,
        inLanguage: 'en',
        author: { '@type': 'Organization', name: 'AgentGrid Editorial' },
        publisher: { '@type': 'Organization', name: 'AgentGrid', url: 'https://agentgrid.me/' },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'AgentGrid', item: 'https://agentgrid.me/' },
          { '@type': 'ListItem', position: 2, name: 'Learn', item: 'https://agentgrid.me/learn/' },
          { '@type': 'ListItem', position: 3, name: item.title, item: url },
        ],
      },
    ],
  };
}
