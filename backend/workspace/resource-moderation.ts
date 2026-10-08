import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ResourceDecisionSchema,
  StaffResourceSchema,
  type ResourceDecision,
} from '../../src/domain/resource-moderation.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function resourceModerationResources(client: SupabaseClient, staff: () => Promise<void>) {
  return {
    async staffResource(resourceId: string) {
      await staff();
      if (!z.uuid().safeParse(resourceId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_resource', { resource_id: resourceId });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = StaffResourceSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.resourceId !== resourceId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async decideResource(input: ResourceDecision) {
      await staff();
      const parsed = ResourceDecisionSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_decide_resource', {
        resource_id: value.resourceId,
        expected_revision: value.expectedRevision,
        expected_release_id: value.expectedReleaseId,
        decision: value.decision,
        explanation: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      const saved = StaffResourceSchema.safeParse(result.data);
      if (
        !saved.success ||
        saved.data.resourceId !== value.resourceId ||
        saved.data.status !== value.decision ||
        saved.data.revision !== value.expectedRevision + 1 ||
        saved.data.releasedVersionId !== value.expectedReleaseId ||
        saved.data.reason !== value.explanation ||
        !saved.data.moderatedAt ||
        saved.data.ownerIsSelf
      )
        throw new HttpFailure(503, 'service-unavailable');
      return saved.data;
    },
  };
}
