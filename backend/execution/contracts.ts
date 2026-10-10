import { z } from 'zod';

export const RunRequestSchema = z.strictObject({
  versionId: z.uuid(),
  idempotencyKey: z.uuid(),
  input: z.string().trim().min(1).max(12_000),
});

export interface RuntimeActor {
  /** Supplied by verified server session + active AgentGrid membership, never request JSON. */
  profileId: string;
  active: boolean;
}

export interface RuntimePackage {
  versionId: string;
  published: boolean;
  /** Separate, operator-reviewed execution allowlist; publication alone is insufficient. */
  executionApproved: boolean;
  specification: unknown;
}

export interface TextProvider {
  /** Stable server-configured provider/model revision displayed before approval. */
  identity: string;
  estimate(instructions: string, input: string): number;
  generate(request: {
    instructions: string;
    input: string;
    maxOutputTokens: number;
    idempotencyKey: string;
    signal: AbortSignal;
  }): Promise<{ text: string; billedMicros: number }>;
}

export type RunState = 'queued' | 'running' | 'succeeded' | 'cancelled' | 'uncertain' | 'blocked';
export interface RunRecord {
  id: string;
  ownerId: string;
  idempotencyKey: string;
  versionId: string;
  providerIdentity: string;
  instructions: string;
  input: string;
  digest: string;
  maximumCostMicros: number;
  approved: boolean;
  state: RunState;
  output: string | null;
}

/** Implement with transactional, owner-scoped RPCs before exposing any route.
 * No lease expiry automatically reissues a provider request: its outcome may be unknown.
 */
export interface RunStore {
  /** Unique (ownerId, idempotencyKey); immutable snapshot on repeat requests. */
  createOrRead(record: RunRecord): Promise<RunRecord>;
  read(ownerId: string, runId: string): Promise<RunRecord | null>;
  claim(ownerId: string, runId: string, digest: string): Promise<boolean>;
  /** Only running records may finish. Cancellation must discard arriving output. */
  finish(
    ownerId: string,
    runId: string,
    state: 'succeeded' | 'uncertain',
    output: string | null,
    billedMicros?: number,
  ): Promise<void>;
}

export class ExecutionError extends Error {
  readonly code:
    | 'disabled'
    | 'membership_required'
    | 'unsupported_package'
    | 'not_found'
    | 'approval_mismatch'
    | 'idempotency_conflict'
    | 'provider_unavailable';
  constructor(code: ExecutionError['code']) {
    super(code);
    this.code = code;
  }
}
