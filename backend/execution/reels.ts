import { z } from 'zod';
import { executionDigest } from './text-run.ts';
import { ExecutionError, type RuntimeActor } from './contracts.ts';
import {
  MediaAssetSchema,
  ReelPlanSchema,
  type ReelProvider,
  type ReelRecord,
  type ReelStore,
} from './reel-contracts.ts';

export async function prepareReel(options: {
  enabled: boolean;
  actor: RuntimeActor;
  request: unknown;
  provider: ReelProvider;
  store: ReelStore;
}): Promise<ReelRecord> {
  if (!options.enabled) throw new ExecutionError('disabled');
  if (!options.actor.active) throw new ExecutionError('membership_required');
  const request = z
    .strictObject({ idempotencyKey: z.uuid(), plan: ReelPlanSchema })
    .parse(options.request);
  const maximumCostMicros = options.provider.estimate(request.plan);
  if (
    !Number.isSafeInteger(maximumCostMicros) ||
    maximumCostMicros < 1 ||
    maximumCostMicros > 5_000_000
  )
    throw new ExecutionError('provider_unavailable');
  const snapshot = {
    ownerId: options.actor.profileId,
    plan: request.plan,
    providerIdentity: options.provider.identity,
    maximumCostMicros,
  };
  const digest = await executionDigest(snapshot);
  const record = await options.store.prepare({
    ...snapshot,
    digest,
    id: crypto.randomUUID(),
    idempotencyKey: request.idempotencyKey,
    state: 'queued',
    taskId: null,
    asset: null,
  });
  if (record.ownerId !== options.actor.profileId || record.digest !== digest)
    throw new ExecutionError('idempotency_conflict');
  return record;
}

export async function renderReel(options: {
  enabled: boolean;
  actor: RuntimeActor;
  runId: string;
  approvedDigest: string;
  provider: ReelProvider;
  store: ReelStore;
}): Promise<void> {
  if (!options.enabled) throw new ExecutionError('disabled');
  if (!options.actor.active) throw new ExecutionError('membership_required');
  const run = await options.store.read(options.actor.profileId, options.runId);
  if (!run || run.ownerId !== options.actor.profileId) throw new ExecutionError('not_found');
  const digest = await executionDigest({
    ownerId: run.ownerId,
    plan: run.plan,
    providerIdentity: run.providerIdentity,
    maximumCostMicros: run.maximumCostMicros,
  });
  if (
    run.digest !== digest ||
    run.digest !== options.approvedDigest ||
    run.providerIdentity !== options.provider.identity
  )
    throw new ExecutionError('approval_mismatch');
  if (!(await options.store.claim(run.ownerId, run.id, run.digest))) return;
  try {
    const task = await options.provider.submit(run.plan, run.id, AbortSignal.timeout(60_000));
    z.string().min(1).max(200).parse(task.taskId);
    await options.store.task(run.ownerId, run.id, task.taskId);
  } catch {
    await options.store.finish(run.ownerId, run.id, null);
    throw new ExecutionError('provider_unavailable');
  }
}

/** Resumable polling of a persisted task; a scheduler may repeat this read safely. */
export async function inspectReel(options: {
  enabled: boolean;
  actor: RuntimeActor;
  runId: string;
  provider: ReelProvider;
  store: ReelStore;
}): Promise<void> {
  if (!options.enabled) throw new ExecutionError('disabled');
  if (!options.actor.active) throw new ExecutionError('membership_required');
  const run = await options.store.read(options.actor.profileId, options.runId);
  if (!run || run.ownerId !== options.actor.profileId) throw new ExecutionError('not_found');
  if (run.state !== 'rendering' || !run.taskId) return;
  if (run.providerIdentity !== options.provider.identity)
    throw new ExecutionError('approval_mismatch');
  try {
    const result = await options.provider.inspect(run.taskId, AbortSignal.timeout(60_000));
    if (result.state === 'pending') return;
    if (result.state === 'failed') {
      await options.store.finish(run.ownerId, run.id, null);
      return;
    }
    const asset = MediaAssetSchema.parse(result.asset);
    if (
      asset.ownerId !== run.ownerId ||
      asset.runId !== run.id ||
      !Number.isSafeInteger(result.billedMicros) ||
      result.billedMicros < 0 ||
      result.billedMicros > run.maximumCostMicros
    )
      throw new Error('Invalid provider output.');
    await options.store.finish(run.ownerId, run.id, asset, result.billedMicros);
  } catch {
    // Transient polling failures do not lose the known task or dispatch another task.
    throw new ExecutionError('provider_unavailable');
  }
}
