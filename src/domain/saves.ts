import { z } from 'zod';

const SavedResourceSchema = z.strictObject({
  resourceId: z.uuid(),
  savedAt: z.iso.datetime({ offset: true }),
  resource: z
    .strictObject({
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(80),
      title: z.string().min(4).max(100),
      summary: z.string().min(60).max(300),
      category: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        .max(80),
    })
    .nullable(),
});
export const SavedListSchema = z.strictObject({
  agents: z.array(SavedResourceSchema).max(20),
  hasMore: z.boolean(),
  offset: z.int().min(0).max(9999),
});
export const SaveStateSchema = z.strictObject({ saved: z.boolean(), available: z.boolean() });
export type SavedList = z.infer<typeof SavedListSchema>;
export type SaveState = z.infer<typeof SaveStateSchema>;
