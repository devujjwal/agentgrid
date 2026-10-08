import { z } from 'zod';
import { AgentSpecificationSchema } from './agent-specification.ts';

export const SubmissionStateSchema = z.enum(['pending', 'approved', 'rejected', 'withdrawn']);
export const VersionNumberSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/)
  .max(24);
export const OwnedVersionSchema = z
  .strictObject({
    id: z.uuid(),
    version: VersionNumberSchema,
    contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
    submittedAt: z.iso.datetime({ offset: true }),
    state: SubmissionStateSchema,
    reason: z.string().max(2400),
    reviewedAt: z.iso.datetime({ offset: true }).nullable(),
  })
  .refine((value) => (value.state === 'pending') === (value.reviewedAt === null), {
    message: 'Submission state and review timestamp must agree.',
  });
export const OwnedVersionsSchema = z.strictObject({
  versions: z.array(OwnedVersionSchema).max(20),
  submissionEnabled: z.boolean(),
  pendingVersionId: z.uuid().nullable(),
  latestVersion: VersionNumberSchema.nullable(),
  hasMore: z.boolean(),
  offset: z.int().min(0).max(9999),
});
export const SubmitVersionSchema = z.strictObject({
  resourceId: z.uuid(),
  expectedRevision: z.int().positive(),
});
export const OwnedVersionDocumentSchema = z
  .strictObject({
    resourceId: z.uuid(),
    sourceVersionId: z.uuid().nullable(),
    record: OwnedVersionSchema,
    specification: AgentSpecificationSchema,
    editorialText: z.string().min(2).max(32000),
  })
  .refine((value) => value.record.version === value.specification.version);
export type OwnedVersionDocument = z.infer<typeof OwnedVersionDocumentSchema>;
export const WithdrawVersionSchema = z.strictObject({
  resourceId: z.uuid(),
  versionId: z.uuid(),
  reason: z.string().trim().min(20).max(2400),
});
export type OwnedVersion = z.infer<typeof OwnedVersionSchema>;
export type OwnedVersions = z.infer<typeof OwnedVersionsSchema>;
export function isLaterVersion(candidate: string, baseline: string): boolean {
  if (
    !VersionNumberSchema.safeParse(candidate).success ||
    !VersionNumberSchema.safeParse(baseline).success
  )
    return false;
  const left = candidate.split('.').map(BigInt),
    right = baseline.split('.').map(BigInt);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return left[index]! > right[index]!;
  }
  return false;
}
