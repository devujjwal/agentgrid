import { z } from 'zod';

const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const PublicationOperationSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('inspect'), requestId: z.uuid() }),
  z.strictObject({ action: z.literal('prepare'), requestId: z.uuid() }),
  z.strictObject({ action: z.literal('publish'), requestId: z.uuid(), fingerprint: digest }),
]);
const receipt = {
  requestId: z.uuid(),
  resourceId: z.uuid(),
  versionId: z.uuid(),
  state: z.enum(['requested', 'cancelled', 'released']),
  expiresAt: z.iso.datetime({ offset: true }),
  decidedAt: z.iso.datetime({ offset: true }).nullable(),
  selfReview: z.boolean(),
  meaning: z.string().max(500),
};
export const PublicationResultSchema = z.union([
  z.strictObject({ state: z.literal('not-found'), meaning: z.string().max(500) }),
  z.strictObject(receipt),
  z.strictObject({
    ...receipt,
    slug: z.string().max(80),
    packageVersion: z.string().max(40),
    reviewFingerprint: digest,
  }),
  z.strictObject({ ...receipt, reviewFingerprint: digest }),
]);
export type PublicationOperation = z.infer<typeof PublicationOperationSchema>;
export type PublicationResult = z.infer<typeof PublicationResultSchema>;
