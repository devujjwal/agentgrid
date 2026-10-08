import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  RequestReleaseSchema,
  ReleaseApprovalSchema,
  ReleaseApprovalsSchema,
  type RequestRelease,
} from '../../src/domain/release-approval.ts';
import { contentChecksum } from '../../src/domain/content-checksum.ts';
import { hasCredentialSignature } from '../security/public-content.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

export function releaseApprovalResources(client: SupabaseClient, staff: () => Promise<void>) {
  return {
    async releaseApprovals(versionId: string) {
      await staff();
      if (!z.uuid().safeParse(versionId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_release_requests', {
        submitted_version_id: versionId,
      });
      if (result.error) databaseFailure(result.error);
      const parsed = ReleaseApprovalsSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.versionId !== versionId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async requestRelease(input: RequestRelease) {
      await staff();
      const parsed = RequestReleaseSchema.safeParse(input);
      if (!parsed.success || hasCredentialSignature(parsed.data))
        throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_request_release', { review_request: value });
      if (result.error) databaseFailure(result.error);
      const receipt = ReleaseApprovalSchema.safeParse(result.data);
      if (
        !receipt.success ||
        (await contentChecksum(
          RequestReleaseSchema.parse(
            Object.fromEntries(
              Object.keys(value).map((key) => [
                key,
                receipt.data[key as keyof typeof receipt.data],
              ]),
            ),
          ),
        )) !== (await contentChecksum(value))
      )
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
    async cancelRelease(requestId: string) {
      await staff();
      if (!z.uuid().safeParse(requestId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_cancel_release_request', {
        request_id: requestId,
      });
      if (result.error) databaseFailure(result.error);
      const parsed = ReleaseApprovalSchema.safeParse(result.data);
      if (
        !parsed.success ||
        parsed.data.requestId !== requestId ||
        parsed.data.state !== 'cancelled'
      )
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
  };
}
