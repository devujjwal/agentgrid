import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DeactivateAccountSchema,
  DeactivatedAccountSchema,
  type DeactivateAccount,
} from '../../src/domain/account.ts';
import type { WorkspaceIdentity } from '../../src/domain/workspace.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function accountResources(
  client: SupabaseClient,
  member: () => Promise<NonNullable<WorkspaceIdentity['profile']>>,
) {
  return {
    async deactivateAccount(input: DeactivateAccount) {
      const parsed = DeactivateAccountSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const profile = await member(),
        value = parsed.data;
      if (profile.id !== value.profileId || profile.username !== value.username)
        throw new HttpFailure(409, 'conflict');
      const result = await client.rpc('agentgrid_deactivate_profile', {
        expected_profile_id: value.profileId,
        confirmed_username: value.username,
      });
      if (result.error) databaseFailure(result.error);
      const receipt = DeactivatedAccountSchema.safeParse(result.data);
      if (!receipt.success || receipt.data.profileId !== value.profileId)
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
  };
}
