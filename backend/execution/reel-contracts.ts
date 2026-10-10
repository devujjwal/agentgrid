import { z } from 'zod';
import {
  PublicationPreviewSchema,
  type PublishApproval,
  type VerifiedConnection,
} from './publication-approval.ts';

import type { ReelPlan, MediaAsset } from '../../src/domain/reels.ts';
export {
  ReelPlanSchema,
  MediaAssetSchema,
  type ReelPlan,
  type MediaAsset,
} from '../../src/domain/reels.ts';

export interface ReelRecord {
  id: string;
  ownerId: string;
  idempotencyKey: string;
  plan: ReelPlan;
  providerIdentity: string;
  maximumCostMicros: number;
  digest: string;
  state: 'queued' | 'rendering' | 'ready' | 'cancelled' | 'uncertain' | 'blocked';
  taskId: string | null;
  asset: MediaAsset | null;
}
export interface ReelStore {
  prepare(record: ReelRecord): Promise<ReelRecord>;
  read(ownerId: string, id: string): Promise<ReelRecord | null>;
  /** Transactionally checks exact fresh approval, flags, active owner and both budgets. */
  claim(ownerId: string, id: string, digest: string): Promise<boolean>;
  /** A write failure after submit is uncertain; never submit a second task. */
  task(ownerId: string, id: string, taskId: string): Promise<void>;
  finish(
    ownerId: string,
    id: string,
    asset: MediaAsset | null,
    billedMicros?: number,
  ): Promise<void>;
}
export interface ReelProvider {
  identity: string;
  estimate(plan: ReelPlan): number;
  submit(plan: ReelPlan, runId: string, signal: AbortSignal): Promise<{ taskId: string }>;
  /** Poll a known task only; never a second generation request. */
  inspect(
    taskId: string,
    signal: AbortSignal,
  ): Promise<
    | { state: 'pending' }
    | { state: 'failed' }
    | { state: 'succeeded'; asset: MediaAsset; billedMicros: number }
  >;
}
export type PublicationPreview = z.infer<typeof PublicationPreviewSchema>;
export interface DeliveryRecord {
  id: string;
  ownerId: string;
  preview: PublicationPreview;
  digest: string;
  connectionId: string;
  state: 'pending' | 'dispatching' | 'published' | 'uncertain' | 'cancelled';
  providerPostId: string | null;
}
export interface DeliveryStore {
  read(ownerId: string, id: string): Promise<DeliveryRecord | null>;
  context(
    ownerId: string,
    id: string,
  ): Promise<{
    approval: PublishApproval | null;
    connections: VerifiedConnection[];
    asset: MediaAsset | null;
  }>;
  /** Rechecks revocation, due time, asset checksum and approval inside its transaction. */
  claim(ownerId: string, id: string, digest: string): Promise<boolean>;
  /** Persist the candidate ID before readback so ambiguous delivery can be reconciled. */
  submitted(ownerId: string, id: string, postId: string): Promise<void>;
  finish(ownerId: string, id: string, postId: string | null): Promise<void>;
}
export interface SocialPublisher {
  platform: 'instagram' | 'facebook' | 'linkedin';
  /** Tokens and provider account IDs are resolved server-side by connectionId. */
  publish(input: {
    connectionId: string;
    caption: string;
    asset: MediaAsset;
    deliveryId: string;
    signal: AbortSignal;
  }): Promise<{ postId: string }>;
  /** Explicit continuation of a saved, fully uploaded asset. Never recreates uploads. */
  resume?(input: {
    connectionId: string;
    caption: string;
    asset: MediaAsset;
    deliveryId: string;
    signal: AbortSignal;
  }): Promise<{ postId: string }>;
  /** Confirm the actual destination and media via provider readback, not HTTP success. */
  verify(input: {
    connectionId: string;
    postId: string;
    caption: string;
    asset: MediaAsset;
    signal: AbortSignal;
  }): Promise<boolean>;
}
