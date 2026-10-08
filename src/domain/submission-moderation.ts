import { z } from 'zod';
import { SubmissionStateSchema, VersionNumberSchema } from './versions.ts';
const date = z.iso.datetime({ offset: true });
const summary = {
  versionId: z.uuid(),
  resourceId: z.uuid(),
  slug: z
    .string()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(100),
  version: VersionNumberSchema,
  state: SubmissionStateSchema,
  submittedAt: date,
};
export const StaffSubmissionSummarySchema = z.strictObject(summary);
export const StaffSubmissionSchema = z
  .strictObject({
    ...summary,
    reason: z.string().max(2400),
    reviewedAt: date.nullable(),
    contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sourceVersionId: z.uuid().nullable(),
    resourceStatus: z.enum(['active', 'blocked', 'archived']),
    authorStatus: z.enum(['active', 'suspended', 'deactivated']),
    authorIsSelf: z.boolean(),
    // Raw bounded text keeps malformed submissions inspectable and rejectable.
    // Only the trusted publication gate parses and approves the complete contract.
    specificationText: z.string().min(2).max(120000),
    editorialText: z.string().min(2).max(32000),
  })
  .refine((value) => (value.state === 'pending') === (value.reviewedAt === null));
export const StaffSubmissionQueueSchema = z
  .strictObject({
    state: SubmissionStateSchema,
    submissions: z.array(StaffSubmissionSummarySchema).max(20),
    offset: z.int().min(0).max(9999),
    hasMore: z.boolean(),
  })
  .refine((value) => value.submissions.every((row) => row.state === value.state))
  .refine(
    (value) =>
      new Set(value.submissions.map((row) => row.versionId)).size === value.submissions.length,
  )
  .refine((value) => !value.hasMore || value.submissions.length === 20);
export const RejectSubmissionSchema = z.strictObject({
  versionId: z.uuid(),
  expectedDigest: z.string().regex(/^[a-f0-9]{64}$/),
  explanation: z.string().trim().min(20).max(2400),
});
export type StaffSubmission = z.infer<typeof StaffSubmissionSchema>;
export type StaffSubmissionQueue = z.infer<typeof StaffSubmissionQueueSchema>;
export type RejectSubmission = z.infer<typeof RejectSubmissionSchema>;
