import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  OwnedReviewSchema,
  ReviewInputSchema,
  ReviewContextSchema,
  WithdrawReviewSchema,
  type ReviewInput,
} from '../../src/domain/reviews.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

export function reviewResources(client: SupabaseClient, member: () => Promise<unknown>) {
  async function review(resourceId: string) {
    await member();
    const result = await client.rpc('agentgrid_owned_review', { resource_id: resourceId });
    if (result.error) databaseFailure(result.error);
    const parsed = OwnedReviewSchema.nullable().safeParse(result.data);
    if (!parsed.success || (parsed.data && parsed.data.resourceId !== resourceId))
      throw new HttpFailure(503, 'service-unavailable');
    return parsed.data;
  }
  return {
    review,
    async reviewContext(resourceId: string) {
      await member();
      const result = await client.rpc('agentgrid_review_context', { resource_id: resourceId });
      if (result.error) databaseFailure(result.error);
      const parsed = ReviewContextSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.resourceId !== resourceId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async withdrawReview(input: z.infer<typeof WithdrawReviewSchema>) {
      await member();
      const parsed = WithdrawReviewSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_withdraw_review', {
        resource_id: value.resourceId,
        expected_revision: value.expectedRevision,
      });
      if (result.error) databaseFailure(result.error);
      const id = z.uuid().safeParse(result.data);
      if (!id.success) throw new HttpFailure(503, 'service-unavailable');
      const confirmed = await review(value.resourceId);
      if (
        !confirmed ||
        confirmed.id !== id.data ||
        confirmed.revision !== value.expectedRevision + 1 ||
        confirmed.state !== 'withdrawn'
      )
        throw new HttpFailure(503, 'service-unavailable');
      return confirmed;
    },
    async writeReview(input: ReviewInput) {
      await member();
      const parsed = ReviewInputSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_write_review', {
        resource_id: value.resourceId,
        used_version: value.usedVersionId,
        requested_rating: value.rating,
        requested_title: value.title,
        requested_body: value.body,
        experience: value.experience,
        expected_revision: value.expectedRevision,
      });
      if (result.error) databaseFailure(result.error);
      const id = z.uuid().safeParse(result.data);
      if (!id.success) throw new HttpFailure(503, 'service-unavailable');
      const confirmed = await review(value.resourceId);
      if (
        !confirmed ||
        confirmed.id !== id.data ||
        confirmed.usedVersionId !== value.usedVersionId ||
        confirmed.revision !== value.expectedRevision + 1 ||
        confirmed.rating !== value.rating ||
        confirmed.title !== value.title ||
        confirmed.body !== value.body ||
        confirmed.experience !== value.experience ||
        confirmed.state === 'withdrawn'
      )
        throw new HttpFailure(503, 'service-unavailable');
      // Moderation may race acknowledgement; return current state, not a claim
      // that the write has been published or reviewed by the platform.
      return confirmed;
    },
  };
}
