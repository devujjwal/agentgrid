import { z } from 'zod';
import { VersionNumberSchema } from './versions.ts';
export const StaffResourceSchema = z
  .strictObject({
    resourceId: z.uuid(),
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(80),
    status: z.enum(['active', 'blocked', 'archived']),
    revision: z.int().min(0).max(2147483647),
    reason: z.string().max(2400),
    moderatedAt: z.iso.datetime({ offset: true }).nullable(),
    ownerIsSelf: z.boolean(),
    ownerStatus: z.enum(['active', 'suspended', 'deactivated']),
    releasedVersionId: z.uuid().nullable(),
    releasedVersion: VersionNumberSchema.nullable(),
  })
  .refine((value) => (value.releasedVersionId === null) === (value.releasedVersion === null));
export type StaffResource = z.infer<typeof StaffResourceSchema>;
export const ResourceDecisionSchema = z.strictObject({
  resourceId: z.uuid(),
  expectedRevision: z.int().min(0).max(2147483646),
  expectedReleaseId: z.uuid().nullable(),
  decision: z.enum(['active', 'blocked']),
  explanation: z.string().trim().min(20).max(2400),
});
export type ResourceDecision = z.infer<typeof ResourceDecisionSchema>;
