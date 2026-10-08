import { z } from 'zod';
const detail = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const date = z.iso.date();
const digest = z.string().regex(/^[a-f0-9]{64}$/);
/** The private redacted artifact must contain observed output, not an illustrative sample. */
export const HostRunSchema = z.strictObject({
  origin: z.literal('real-host'),
  platform_slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  host_version: detail(3, 160),
  scenario: z.enum(['normal', 'ambiguous-input', 'adversarial-input']),
  specification_sha256: digest,
  completed_on: date,
  input: detail(80, 8000),
  observed_output: detail(80, 16000),
  assertions: z
    .array(z.strictObject({ description: detail(24, 600), passed: z.boolean() }))
    .min(2)
    .max(12),
  reviewer_notes: detail(80, 1600),
});
export type HostVerificationRun = z.infer<typeof HostRunSchema>;

export const RecordHostRunSchema = z.strictObject({
  recordId: z.uuid(),
  versionId: z.uuid(),
  expectedDigest: digest,
  run: HostRunSchema,
});
export const HostRunReceiptSchema = z.strictObject({
  id: z.uuid(),
  versionId: z.uuid(),
  contentDigest: digest,
  recordedAt: z.iso.datetime({ offset: true }),
  run: HostRunSchema,
});
export const HostRunSummarySchema = HostRunReceiptSchema.omit({ run: true }).extend({
  platform: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  scenario: z.enum(['normal', 'ambiguous-input', 'adversarial-input']),
  completedOn: z.iso.date(),
  failedChecks: z.int().min(0).max(12),
});
export type HostRunSummary = z.infer<typeof HostRunSummarySchema>;
export function summarizeHostRun(receipt: HostRunReceipt): HostRunSummary {
  const { run, ...identity } = receipt;
  return {
    ...identity,
    platform: run.platform_slug,
    scenario: run.scenario,
    completedOn: run.completed_on,
    failedChecks: run.assertions.filter((check) => !check.passed).length,
  };
}
export const HostRunListSchema = z
  .strictObject({ versionId: z.uuid(), runs: z.array(HostRunSummarySchema).max(60) })
  .refine(
    (value) =>
      value.runs.every((run) => run.versionId === value.versionId) &&
      new Set(value.runs.map((run) => run.id)).size === value.runs.length,
  );
export type RecordHostRun = z.infer<typeof RecordHostRunSchema>;
export type HostRunReceipt = z.infer<typeof HostRunReceiptSchema>;
