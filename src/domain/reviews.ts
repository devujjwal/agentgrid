import { z } from 'zod';
import { VersionNumberSchema } from './versions.ts';

const Fields = {
  resourceId: z.uuid(),
  usedVersionId: z.uuid(),
  rating: z.int().min(1).max(5),
  title: z.string().trim().min(10).max(140),
  body: z.string().trim().min(80).max(4000),
  experience: z.string().trim().min(40).max(1000),
};
export const ReviewInputSchema = z.strictObject({
  ...Fields,
  expectedRevision: z.int().min(0).max(2147483646),
});
export type ReviewInput = z.infer<typeof ReviewInputSchema>;
const date = z.iso.datetime({ offset: true });
export const OwnedReviewSchema = z
  .strictObject({
    ...Fields,
    id: z.uuid(),
    version: VersionNumberSchema,
    revision: z.int().min(1).max(2147483647),
    createdAt: date,
    updatedAt: date,
    state: z.enum(['pending', 'published', 'hidden', 'withdrawn']),
    withdrawnAt: date.nullable(),
    reason: z.string().max(2400),
    reviewedAt: date.nullable(),
  })
  .refine((value) =>
    value.state === 'pending' || value.state === 'withdrawn'
      ? value.reviewedAt === null && value.reason === ''
      : value.reviewedAt !== null && value.reason.trim().length >= 20,
  )
  .refine((value) => (value.state === 'withdrawn') === (value.withdrawnAt !== null));
export type OwnedReview = z.infer<typeof OwnedReviewSchema>;
export const WithdrawReviewSchema = z.strictObject({
  resourceId: Fields.resourceId,
  expectedRevision: z.int().min(1).max(2147483646),
});
export const ReviewContextSchema = z
  .strictObject({
    resourceId: Fields.resourceId,
    review: OwnedReviewSchema.nullable(),
    available: z.boolean(),
    canReview: z.boolean(),
    currentVersion: z.strictObject({ id: z.uuid(), version: VersionNumberSchema }).nullable(),
  })
  .refine((value) => value.available === (value.currentVersion !== null))
  .refine((value) => !value.canReview || value.available)
  .refine((value) => !value.review || value.review.resourceId === value.resourceId);
export type ReviewContext = z.infer<typeof ReviewContextSchema>;
export const PublicReviewSchema = z.strictObject({
  id: z.uuid(),
  usedVersionId: z.uuid(),
  version: VersionNumberSchema,
  rating: Fields.rating,
  title: Fields.title,
  body: Fields.body,
  experience: Fields.experience,
  createdAt: date,
  updatedAt: date,
  author: z.strictObject({
    name: z.string().min(2).max(80),
    username: z
      .string()
      .regex(/^[a-z][a-z0-9_]{2,29}$/)
      .nullable(),
  }),
});
export const PublicReviewsSchema = z
  .strictObject({
    resourceId: z.uuid(),
    reviewCount: z.int().min(0).max(1000000000),
    averageRating: z.number().min(1).max(5).nullable(),
    reviews: z.array(PublicReviewSchema).max(20),
    offset: z.int().min(0).max(9999),
    hasMore: z.boolean(),
  })
  .refine((value) => (value.reviewCount === 0) === (value.averageRating === null))
  .refine((value) => value.reviews.length <= Math.max(0, value.reviewCount - value.offset))
  .refine((value) => !value.hasMore || value.offset + value.reviews.length < value.reviewCount)
  .refine(
    (value) => new Set(value.reviews.map((review) => review.id)).size === value.reviews.length,
  );
export type PublicReviews = z.infer<typeof PublicReviewsSchema>;
