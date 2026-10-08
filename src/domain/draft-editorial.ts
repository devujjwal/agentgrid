import { z } from 'zod';
import { assertJsonDocumentBounds } from './agent-specification.ts';

const text = (maximum: number) => z.string().max(maximum);
const date = z.union([z.literal(''), z.iso.date()]);
/** Unfinished author-provided guide. Declarations are not staff approval or host evidence. */
export const DraftEditorialSchema = z.strictObject({
  search_intent: text(300).default(''),
  overview: text(4000).default(''),
  audience: z.array(text(240)).max(8).default([]),
  workflow: z.array(text(1000)).max(10).default([]),
  faq: z
    .array(z.strictObject({ question: text(180), answer: text(1600) }))
    .max(10)
    .default([]),
  sources: z
    .array(
      z.strictObject({ title: text(160), url: text(2048), supports: text(600), checked_on: date }),
    )
    .max(12)
    .default([]),
  related_agent_slugs: z.array(text(80)).max(8).default([]),
  discovery: z
    .strictObject({
      keywords: z.array(text(80)).max(30),
      capability_tags: z.array(text(60)).max(8),
    })
    .default({ keywords: [], capability_tags: [] }),
  reviewed_on: date.default(''),
  review: z
    .strictObject({
      standalone_value: z.boolean(),
      task_specific_instructions: z.boolean(),
      cost_disclosure: z.boolean(),
      security_and_privacy: z.boolean(),
      distribution_steps: z.boolean(),
      reuse_rights: z.boolean(),
    })
    .default({
      standalone_value: false,
      task_specific_instructions: false,
      cost_disclosure: false,
      security_and_privacy: false,
      distribution_steps: false,
      reuse_rights: false,
    }),
});
export type DraftEditorial = z.infer<typeof DraftEditorialSchema>;
export function parseDraftEditorial(value: unknown): DraftEditorial {
  assertJsonDocumentBounds(value);
  const parsed = DraftEditorialSchema.parse(value);
  // Pretty printing is conservatively larger than PostgreSQL's JSONB text; stay
  // below its 32KB immutable-bundle constraint, including multibyte prose.
  if (new TextEncoder().encode(JSON.stringify(parsed, null, 2)).byteLength > 30_000)
    throw new Error('The guide exceeds its 30KB document limit. Shorten it before saving.');
  return parsed;
}
