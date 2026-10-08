import { z } from 'zod';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const ReleaseChecksSchema = z.strictObject({
  standaloneValue: z.literal(true),
  sourceAccuracy: z.literal(true),
  platformEvidence: z.literal(true),
  privacyAndSecurity: z.literal(true),
  distributionAndCosts: z.literal(true),
  reuseRights: z.literal(true),
});
export const RequestReleaseSchema = z.strictObject({
  requestId: z.uuid(),
  versionId: z.uuid(),
  expectedDigest: digest,
  expectedResourceRevision: z.int().min(0),
  expectedReleaseId: z.uuid().nullable(),
  evidenceIds: z
    .array(z.uuid())
    .min(3)
    .max(40)
    .refine((ids) => new Set(ids).size === ids.length),
  checks: ReleaseChecksSchema,
  explanation: z.string().trim().min(80).max(2400),
});
export const ReleaseApprovalSchema = RequestReleaseSchema.extend({
  resourceId: z.uuid(),
  selfReview: z.boolean(),
  requestedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  state: z.enum(['requested', 'cancelled', 'released']),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
}).refine((value) => (value.state === 'requested') === (value.decidedAt === null));
export const ReleaseApprovalsSchema = z
  .strictObject({
    versionId: z.uuid(),
    approvals: z.array(ReleaseApprovalSchema).max(20),
  })
  .refine(
    (value) =>
      value.approvals.every((row) => row.versionId === value.versionId) &&
      new Set(value.approvals.map((row) => row.requestId)).size === value.approvals.length,
  );
export const CancelReleaseSchema = z.strictObject({ requestId: z.uuid() });
export type RequestRelease = z.infer<typeof RequestReleaseSchema>;
export type ReleaseApproval = z.infer<typeof ReleaseApprovalSchema>;
