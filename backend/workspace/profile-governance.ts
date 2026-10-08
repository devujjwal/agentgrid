import type { SupabaseClient } from '@supabase/supabase-js';
import type { WorkspaceIdentity } from '../../src/domain/workspace.ts';
import { ProfileSchema } from '../../src/domain/workspace.ts';
import {
  AdminProfileSchema,
  ProfileDecisionSchema,
  type ProfileDecision,
} from '../../src/domain/profile-governance.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function profileGovernance(
  client: SupabaseClient,
  identity: () => Promise<WorkspaceIdentity>,
) {
  async function administrator() {
    const current = await identity();
    if (current.profile?.status !== 'active' || !current.roles.includes('administrator'))
      throw new HttpFailure(403, 'request-refused');
  }
  return {
    async profile(username: string) {
      await administrator();
      if (!ProfileSchema.shape.username.safeParse(username).success)
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_admin_profile', { requested_username: username });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = AdminProfileSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.username !== username)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async decide(input: ProfileDecision) {
      await administrator();
      const parsed = ProfileDecisionSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_decide_profile', {
        target_profile_id: value.profileId,
        expected_revision: value.expectedRevision,
        decision: value.decision,
        decision_reason: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      const receipt = AdminProfileSchema.safeParse(result.data);
      if (
        !receipt.success ||
        receipt.data.id !== value.profileId ||
        receipt.data.revision !== value.expectedRevision + 1
      )
        throw new HttpFailure(503, 'service-unavailable');
      const action = value.decision;
      if (
        (action === 'suspend' && receipt.data.status !== 'suspended') ||
        (action === 'restore' && receipt.data.status !== 'active') ||
        (action.endsWith('moderator') &&
          receipt.data.roles.includes('moderator') !== action.startsWith('grant-')) ||
        (action.endsWith('administrator') &&
          receipt.data.roles.includes('administrator') !== action.startsWith('grant-'))
      )
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
  };
}
