import { parseAgentSpecification } from '../../src/domain/agent-specification.ts';
import {
  ExecutionError,
  RunRequestSchema,
  type RunRecord,
  type RunStore,
  type RuntimeActor,
  type RuntimePackage,
  type TextProvider,
} from './contracts.ts';

export async function executionDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function requireRuntime(enabled: boolean, actor: RuntimeActor): void {
  if (!enabled) throw new ExecutionError('disabled');
  if (!actor.active) throw new ExecutionError('membership_required');
}

/** This service is deliberately not wired to production HTTP. A durable store,
 * budget reservation and provider adapter are release prerequisites, not fallbacks.
 */
export async function prepareTextRun(options: {
  enabled: boolean;
  actor: RuntimeActor;
  request: unknown;
  resource: RuntimePackage;
  provider: TextProvider;
  store: RunStore;
}): Promise<RunRecord> {
  requireRuntime(options.enabled, options.actor);
  const request = RunRequestSchema.parse(options.request);
  const resource = options.resource;
  if (
    !resource.published ||
    !resource.executionApproved ||
    resource.versionId !== request.versionId
  )
    throw new ExecutionError('unsupported_package');
  const specification = parseAgentSpecification(resource.specification);
  if (
    specification.execution.mode !== 'interactive' ||
    specification.execution.autonomy !== 'assistive' ||
    specification.tools.length !== 0 ||
    specification.permissions.some((permission) => permission.operation !== 'read') ||
    !specification.license.permissions.use
  )
    throw new ExecutionError('unsupported_package');
  const snapshot = {
    versionId: request.versionId,
    providerIdentity: options.provider.identity,
    instructions: specification.execution.instructions,
    input: request.input,
  };
  const digest = await executionDigest(snapshot);
  const record = await options.store.createOrRead({
    ...snapshot,
    id: crypto.randomUUID(),
    ownerId: options.actor.profileId,
    idempotencyKey: request.idempotencyKey,
    digest,
    state: 'queued',
    output: null,
  });
  if (record.ownerId !== options.actor.profileId || record.digest !== digest)
    throw new ExecutionError('idempotency_conflict');
  return record;
}

/** Approval means the member confirmed this exact input + resource + provider.
 * Client request fields cannot change the pinned instructions or model selection.
 */
export async function executeTextRun(options: {
  enabled: boolean;
  actor: RuntimeActor;
  runId: string;
  approvedDigest: string;
  provider: TextProvider;
  store: RunStore;
}): Promise<RunRecord> {
  requireRuntime(options.enabled, options.actor);
  const owner = options.actor.profileId;
  const record = await options.store.read(owner, options.runId);
  if (!record || record.ownerId !== owner) throw new ExecutionError('not_found');
  if (
    record.digest !== options.approvedDigest ||
    record.providerIdentity !== options.provider.identity
  )
    throw new ExecutionError('approval_mismatch');
  if (!(await options.store.claim(owner, record.id, record.digest))) {
    const current = await options.store.read(owner, record.id);
    if (!current) throw new ExecutionError('not_found');
    return current;
  }
  try {
    const result = await options.provider.generate({
      instructions: record.instructions,
      input: record.input,
      maxOutputTokens: 2048,
      // Stable across worker restarts; never substitute another key on retry.
      idempotencyKey: record.id,
      signal: AbortSignal.timeout(60_000),
    });
    if (typeof result.text !== 'string' || !result.text.trim() || result.text.length > 32_000)
      throw new Error('Invalid provider output.');
    await options.store.finish(owner, record.id, 'succeeded', result.text);
  } catch {
    // Timeout/disconnect can happen after billing or successful generation.
    // Preserve a reconciliation state; do not leak provider responses or retry blindly.
    await options.store.finish(owner, record.id, 'uncertain', null);
    throw new ExecutionError('provider_unavailable');
  }
  const current = await options.store.read(owner, record.id);
  if (!current) throw new ExecutionError('not_found');
  return current;
}
