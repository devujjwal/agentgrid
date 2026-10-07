import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { WorkspaceIdentity } from '../../src/domain/workspace.ts';
import {
  ReviewDecisionSchema,
  ReviewQueueStateSchema,
  StaffReviewSchema,
  StaffReviewSummarySchema,
  StaffReviewQueueSchema,
  type ReviewDecision,
  type ReviewQueueState,
} from '../../src/domain/moderation.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
import { reportModerationResources } from './report-moderation.ts';

export function moderationResources(
  client: SupabaseClient,
  identity: () => Promise<WorkspaceIdentity>,
) {
  async function staff() {
    const current = await identity();
    if (
      current.profile?.status !== 'active' ||
      !current.roles.some((role) => role === 'moderator' || role === 'administrator')
    )
      throw new HttpFailure(403, 'request-refused');
  }
  return {
    ...reportModerationResources(client, staff),
    async reviewQueue(state: ReviewQueueState, offset: number) {
      await staff();
      if (
        !ReviewQueueStateSchema.safeParse(state).success ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 9999
      )
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_reviews', {
        requested_state: state,
        requested_offset: offset,
      });
      if (result.error) databaseFailure(result.error);
      const rows = z.array(StaffReviewSummarySchema).max(21).safeParse(result.data);
      if (
        !rows.success ||
        rows.data.some((row) => row.state !== state) ||
        new Set(rows.data.map((row) => row.id)).size !== rows.data.length
      )
        throw new HttpFailure(503, 'service-unavailable');
      return StaffReviewQueueSchema.parse({
        state,
        reviews: rows.data.slice(0, 20),
        hasMore: rows.data.length > 20,
        offset,
      });
    },
    async staffReview(reviewId: string) {
      await staff();
      if (!z.uuid().safeParse(reviewId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_review', { review_resource_id: reviewId });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = StaffReviewSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.id !== reviewId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async decideReview(input: ReviewDecision) {
      await staff();
      const parsed = ReviewDecisionSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_decide_review', {
        review_resource_id: value.reviewId,
        expected_revision: value.expectedRevision,
        expected_decision_revision: value.expectedDecisionRevision,
        decision: value.decision,
        explanation: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      // The RPC returns its exact transaction snapshot. A missing or mismatched
      // acknowledgement is uncertain; callers must read live state before retry.
      const confirmed = StaffReviewSchema.safeParse(result.data);
      if (
        !confirmed.success ||
        confirmed.data.id !== value.reviewId ||
        confirmed.data.revision !== value.expectedRevision ||
        confirmed.data.decisionRevision !== value.expectedDecisionRevision + 1 ||
        confirmed.data.state !== value.decision ||
        confirmed.data.reason !== value.explanation
      )
        throw new HttpFailure(503, 'service-unavailable');
      return confirmed.data;
    },
  };
}
