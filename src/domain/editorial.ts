/** Editorial structure is portable; approval remains a trusted backend decision. */
import { z } from 'zod';
const detail = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const date = z.iso.date();
const httpsUrl = z.url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
});
export const EditorialSchema = z.strictObject({
  search_intent: detail(40, 300),
  overview: detail(240, 4000),
  audience: z.array(detail(24, 240)).min(2).max(8),
  workflow: z.array(detail(60, 1000)).min(3).max(10),
  faq: z
    .array(z.strictObject({ question: detail(12, 180), answer: detail(80, 1600) }))
    .min(3)
    .max(10),
  sources: z
    .array(
      z.strictObject({
        title: detail(8, 160),
        url: httpsUrl,
        supports: detail(40, 600),
        checked_on: date,
      }),
    )
    .min(1)
    .max(12),
  related_agent_slugs: z
    .array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/))
    .min(2)
    .max(8),
  discovery: z
    .strictObject({
      keywords: z.array(detail(2, 80)).min(3).max(30),
      capability_tags: z
        .array(
          z
            .string()
            .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
            .max(60),
        )
        .min(1)
        .max(8),
    })
    .optional(),
  reviewed_on: date,
  review: z.strictObject({
    standalone_value: z.literal(true),
    task_specific_instructions: z.literal(true),
    cost_disclosure: z.literal(true),
    security_and_privacy: z.literal(true),
    distribution_steps: z.literal(true),
    reuse_rights: z.literal(true),
  }),
});

export type EditorialContent = z.infer<typeof EditorialSchema>;
export const PublicEditorialSchema = EditorialSchema.omit({ search_intent: true, review: true });
export type PublicEditorial = z.infer<typeof PublicEditorialSchema>;
