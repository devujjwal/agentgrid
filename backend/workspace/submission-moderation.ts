import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SubmissionStateSchema } from '../../src/domain/versions.ts';
import {
  StaffSubmissionSchema,
  StaffSubmissionSummarySchema,
  StaffSubmissionQueueSchema,
  RejectSubmissionSchema,
  type RejectSubmission,
} from '../../src/domain/submission-moderation.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function submissionModerationResources(client: SupabaseClient, staff: () => Promise<void>) {
  return {
    async submissionQueue(state: z.infer<typeof SubmissionStateSchema>, offset: number) {
      await staff();
      if (
        !SubmissionStateSchema.safeParse(state).success ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 9999
      )
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_submissions', {
        requested_state: state,
        requested_offset: offset,
      });
      if (result.error) databaseFailure(result.error);
      const rows = z.array(StaffSubmissionSummarySchema).max(21).safeParse(result.data);
      if (
        !rows.success ||
        rows.data.some((row) => row.state !== state) ||
        new Set(rows.data.map((row) => row.versionId)).size !== rows.data.length
      )
        throw new HttpFailure(503, 'service-unavailable');
      return StaffSubmissionQueueSchema.parse({
        state,
        offset,
        submissions: rows.data.slice(0, 20),
        hasMore: rows.data.length > 20,
      });
    },
    async staffSubmission(versionId: string) {
      await staff();
      if (!z.uuid().safeParse(versionId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_submission', {
        submitted_version_id: versionId,
      });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = StaffSubmissionSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.versionId !== versionId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async rejectSubmission(input: RejectSubmission) {
      await staff();
      const parsed = RejectSubmissionSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_reject_submission', {
        submitted_version_id: value.versionId,
        expected_digest: value.expectedDigest,
        explanation: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      const receipt = StaffSubmissionSchema.safeParse(result.data);
      if (
        !receipt.success ||
        receipt.data.versionId !== value.versionId ||
        receipt.data.contentDigest !== value.expectedDigest ||
        receipt.data.state !== 'rejected' ||
        receipt.data.reason !== value.explanation
      )
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
  };
}
