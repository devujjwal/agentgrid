import { z } from 'zod';
import { ReelPlanSchema } from './reels.ts';
export const PlatformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const PublicationPreviewSchema = z.strictObject({
  runId: z.uuid(),
  revision: z.int().positive(),
  mediaId: z.uuid(),
  mediaSha256: digest,
  destinations: z
    .array(
      z
        .strictObject({
          platform: PlatformSchema,
          connectionId: z.uuid(),
          caption: z.string().trim().min(1).max(3000),
        })
        .refine(
          (d) => d.platform !== 'instagram' || d.caption.length <= 2200,
          'Instagram captions support at most 2200 characters.',
        ),
    )
    .min(1)
    .max(3)
    .refine(
      (d) => new Set(d.map((v) => v.connectionId)).size === d.length,
      'Each destination must be distinct.',
    ),
  scheduledAt: z.iso.datetime(),
});
export const ConnectionSummarySchema = z.strictObject({
  id: z.uuid(),
  platform: PlatformSchema,
  label: z.string().min(1).max(160),
  expiresAt: z.iso.datetime({ offset: true }),
  publishingEnabled: z.boolean(),
});
export const ReelSummarySchema = z.strictObject({
  id: z.uuid(),
  plan: ReelPlanSchema,
  digest,
  maximumCostMicros: z.int().positive().max(5000000),
  state: z.enum(['queued', 'rendering', 'ready', 'cancelled', 'uncertain', 'blocked']),
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
  asset: z
    .strictObject({ id: z.uuid(), sha256: digest, seconds: z.number().positive().max(30) })
    .nullable(),
});
export const PublicationSummarySchema = z.strictObject({
  id: z.uuid(),
  preview: PublicationPreviewSchema,
  digest,
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
  deliveries: z
    .array(
      z.strictObject({
        id: z.uuid(),
        connectionId: z.uuid(),
        state: z.enum(['pending', 'dispatching', 'published', 'uncertain', 'cancelled']),
        canResume: z.boolean(),
      }),
    )
    .max(3),
});
const budget = z.strictObject({
  limitMicros: z.int().nonnegative(),
  heldMicros: z.int().nonnegative(),
  spentMicros: z.int().nonnegative(),
});
export const MediaOverviewSchema = z.strictObject({
  observedAt: z.iso.datetime({ offset: true }),
  capabilities: z.strictObject({
    connect: z.boolean(),
    render: z.boolean(),
    publish: z.boolean(),
    schedule: z.boolean(),
  }),
  budget,
  siteBudget: budget,
  sources: z.array(z.strictObject({ id: z.uuid() })).max(20),
  connections: z.array(ConnectionSummarySchema).max(30),
  reels: z.array(ReelSummarySchema).max(20),
  publications: z.array(PublicationSummarySchema).max(20),
});
export type MediaOverview = z.infer<typeof MediaOverviewSchema>;
export type ConnectionSummary = z.infer<typeof ConnectionSummarySchema>;
export type ReelSummary = z.infer<typeof ReelSummarySchema>;
export type PublicationSummary = z.infer<typeof PublicationSummarySchema>;
