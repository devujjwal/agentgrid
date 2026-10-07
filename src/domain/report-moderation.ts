import { z } from 'zod';
import { AgentSpecificationSchema } from './agent-specification.ts';
import { VersionNumberSchema } from './versions.ts';
import { OwnedReportSchema, ReportCategorySchema, ReportTargetSchema } from './reports.ts';

const date = z.iso.datetime({ offset: true });
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80);
export const ReportQueueStateSchema = z.enum(['open', 'resolved', 'dismissed']);
export type ReportQueueState = z.infer<typeof ReportQueueStateSchema>;
export const ReportSnapshotSchema = z.discriminatedUnion('kind', [
  z
    .strictObject({
      kind: z.literal('agent'),
      slug,
      versionId: z.uuid(),
      version: VersionNumberSchema,
      specification: AgentSpecificationSchema,
    })
    .refine(
      (value) =>
        value.specification.identity.slug === value.slug &&
        value.specification.version === value.version,
    ),
  z.strictObject({
    kind: z.literal('review'),
    resourceId: z.uuid(),
    resourceSlug: slug,
    usedVersionId: z.uuid(),
    version: VersionNumberSchema,
    revision: z.int().min(1).max(2147483647),
    title: z.string().min(10).max(140),
    body: z.string().min(80).max(4000),
    experience: z.string().min(40).max(1000),
    rating: z.int().min(1).max(5),
  }),
  z.strictObject({
    kind: z.literal('profile'),
    username: z.string().regex(/^[a-z][a-z0-9_]{2,29}$/),
    displayName: z.string().min(2).max(80),
    bio: z.string().max(1600),
    website: z.string().max(2048).nullable(),
  }),
]);
export const StaffReportSchema = OwnedReportSchema.safeExtend({
  conflictOfInterest: z.boolean(),
  context: z.strictObject({ capturedAt: date, snapshot: ReportSnapshotSchema }).nullable(),
}).refine((value) => !value.context || value.context.snapshot.kind === value.targetKind);
export type StaffReport = z.infer<typeof StaffReportSchema>;
export const StaffReportSummarySchema = z.strictObject({
  id: z.uuid(),
  targetKind: ReportTargetSchema,
  category: ReportCategorySchema,
  state: ReportQueueStateSchema,
  createdAt: date,
});
export const StaffReportQueueSchema = z
  .strictObject({
    state: ReportQueueStateSchema,
    reports: z.array(StaffReportSummarySchema).max(20),
    offset: z.int().min(0).max(9999),
    hasMore: z.boolean(),
  })
  .refine((value) => value.reports.every((row) => row.state === value.state))
  .refine((value) => new Set(value.reports.map((row) => row.id)).size === value.reports.length)
  .refine((value) => !value.hasMore || value.reports.length === 20);
export type StaffReportQueue = z.infer<typeof StaffReportQueueSchema>;
export const ReportDecisionSchema = z.strictObject({
  reportId: z.uuid(),
  decision: z.enum(['resolved', 'dismissed']),
  explanation: z.string().trim().min(20).max(2400),
});
export type ReportDecision = z.infer<typeof ReportDecisionSchema>;
