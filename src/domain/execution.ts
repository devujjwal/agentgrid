import { z } from 'zod';

export const StoredRunSchema = z.strictObject({
  id: z.uuid(),
  ownerId: z.uuid(),
  idempotencyKey: z.uuid(),
  versionId: z.uuid(),
  providerIdentity: z.string().min(1).max(120),
  instructions: z.string().max(24_000),
  input: z.string().min(1).max(12_000),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  approved: z.boolean(),
  maximumCostMicros: z.int().positive().max(250_000),
  state: z.enum(['queued', 'running', 'succeeded', 'cancelled', 'uncertain', 'blocked']),
  output: z.string().max(32_000).nullable(),
});
export type StoredRun = z.infer<typeof StoredRunSchema>;
export const ExecutionOverviewSchema = z.strictObject({
  enabled: z.boolean(),
  agents: z.array(z.strictObject({ versionId: z.uuid(), name: z.string().max(100) })).max(50),
  runs: z.array(StoredRunSchema).max(20),
  budget: z.strictObject({
    limitMicros: z.int().nonnegative(),
    heldMicros: z.int().nonnegative(),
    spentMicros: z.int().nonnegative(),
  }),
});
export type ExecutionOverview = z.infer<typeof ExecutionOverviewSchema>;
