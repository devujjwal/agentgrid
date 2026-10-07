import { z } from 'zod';
import { VersionNumberSchema } from './versions.ts';

export const ReviewQueueStateSchema = z.enum(['pending', 'published', 'hidden']);
export type ReviewQueueState = z.infer<typeof ReviewQueueStateSchema>;
const revision = z.int().min(1).max(2147483647);
const decisionRevision = z.int().min(0).max(2147483647);
const date = z.iso.datetime({ offset: true });
const summary = {
  id: z.uuid(),
  resourceId: z.uuid(),
  resourceSlug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  title: z.string().min(10).max(140),
  revision,
  decisionRevision,
  createdAt: date,
};
export const StaffReviewSummarySchema = z.strictObject({
  ...summary,
  state: ReviewQueueStateSchema,
});
export const StaffReviewSchema = z
  .strictObject({
    ...summary,
    resourceAvailable: z.boolean(),
    authorActive: z.boolean(),
    authorIsSelf: z.boolean(),
    usedVersionId: z.uuid(),
    version: VersionNumberSchema,
    rating: z.int().min(1).max(5),
    body: z.string().min(80).max(4000),
    experience: z.string().min(40).max(1000),
    state: z.enum(['pending', 'published', 'hidden', 'withdrawn']),
    reason: z.string().max(2400),
    reviewedAt: date.nullable(),
    withdrawnAt: date.nullable(),
    updatedAt: date,
  })
  .refine((value) => (value.state === 'withdrawn') === (value.withdrawnAt !== null))
  .refine(
    (value) =>
      value.state === 'withdrawn' ||
      (value.state === 'pending'
        ? value.reason === '' && value.reviewedAt === null
        : value.reason.trim().length >= 20 && value.reviewedAt !== null),
  );
export type StaffReview = z.infer<typeof StaffReviewSchema>;
export const StaffReviewQueueSchema = z
  .strictObject({
    state: ReviewQueueStateSchema,
    reviews: z.array(StaffReviewSummarySchema).max(20),
    offset: z.int().min(0).max(9999),
    hasMore: z.boolean(),
  })
  .refine((value) => value.reviews.every((row) => row.state === value.state))
  .refine((value) => new Set(value.reviews.map((row) => row.id)).size === value.reviews.length)
  .refine((value) => !value.hasMore || value.reviews.length === 20);
export type StaffReviewQueue = z.infer<typeof StaffReviewQueueSchema>;
export const ReviewDecisionSchema = z.strictObject({
  reviewId: z.uuid(),
  expectedRevision: z.int().min(1).max(2147483646),
  expectedDecisionRevision: z.int().min(0).max(2147483645),
  decision: z.enum(['published', 'hidden']),
  explanation: z.string().trim().min(20).max(2400),
});
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
