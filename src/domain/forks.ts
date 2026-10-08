import { z } from 'zod';
import { PackageLicenseSchema } from './agent-specification.ts';
import { VersionNumberSchema } from './versions.ts';
const slug = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .refine((value) => !['categories', 'new', 'search', 'submit'].includes(value));
export const ForkInputSchema = z.strictObject({
  sourceVersionId: z.uuid(),
  slug,
  name: z.string().trim().min(4).max(100),
});
export const ForkSourceSchema = z
  .strictObject({
    sourceVersionId: z.uuid(),
    resourceId: z.uuid(),
    slug,
    name: z.string().min(4).max(100),
    version: VersionNumberSchema,
    creatorName: z.string().min(1).max(100),
    license: PackageLicenseSchema,
  })
  .refine(
    (value) => value.license.identifier !== 'unselected' && value.license.permissions.public_fork,
  );
export const ForkReceiptSchema = z.strictObject({
  resourceId: z.uuid(),
  sourceVersionId: z.uuid(),
  slug,
  created: z.boolean(),
});
export type ForkInput = z.infer<typeof ForkInputSchema>;
export type ForkSource = z.infer<typeof ForkSourceSchema>;
export type ForkReceipt = z.infer<typeof ForkReceiptSchema>;
