import { z } from 'zod';

export const ReportTargetSchema = z.enum(['agent', 'review', 'profile']);
export const ReportCategorySchema = z.enum([
  'spam',
  'unsafe-instructions',
  'privacy',
  'copyright',
  'broken-package',
  'other',
]);
export const ReportInputSchema = z.strictObject({
  targetKind: ReportTargetSchema,
  targetId: z.uuid(),
  category: ReportCategorySchema,
  explanation: z.string().trim().min(40).max(2400),
});
export type ReportInput = z.infer<typeof ReportInputSchema>;
export const OwnedReportSchema = z
  .strictObject({
    id: z.uuid(),
    targetKind: ReportTargetSchema,
    targetId: z.uuid(),
    category: ReportCategorySchema,
    explanation: z.string().min(40).max(2400),
    state: z.enum(['open', 'resolved', 'dismissed']),
    resolution: z.string().max(2400),
    resolvedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .refine((value) =>
    value.state === 'open'
      ? value.resolvedAt === null && value.resolution === ''
      : value.resolvedAt !== null && value.resolution.trim().length >= 20,
  );
export type OwnedReport = z.infer<typeof OwnedReportSchema>;
export const OwnedReportsSchema = z.strictObject({
  reports: z.array(OwnedReportSchema).max(20),
  hasMore: z.boolean(),
  offset: z.int().min(0).max(9999),
});
export type OwnedReports = z.infer<typeof OwnedReportsSchema>;
