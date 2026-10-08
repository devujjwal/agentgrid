import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  HostRunListSchema,
  HostRunReceiptSchema,
  RecordHostRunSchema,
  type RecordHostRun,
} from '../../src/domain/host-verification.ts';
import { parseAgentSpecification } from '../../src/domain/agent-specification.ts';
import { contentChecksum } from '../publication/quality.ts';
import { hasCredentialSignature } from '../security/public-content.ts';
import type { StaffSubmission } from '../../src/domain/submission-moderation.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function hostVerificationResources(
  client: SupabaseClient,
  staff: () => Promise<void>,
  submission: (id: string) => Promise<StaffSubmission>,
  now: () => Date = () => new Date(),
) {
  return {
    async hostRun(recordId: string) {
      await staff();
      if (!z.uuid().safeParse(recordId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_host_run', { record_id: recordId });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = HostRunReceiptSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.id !== recordId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async hostRuns(versionId: string) {
      await staff();
      if (!z.uuid().safeParse(versionId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_host_runs', {
        submitted_version_id: versionId,
      });
      if (result.error) databaseFailure(result.error);
      const rows = HostRunListSchema.safeParse(result.data);
      if (!rows.success || rows.data.versionId !== versionId)
        throw new HttpFailure(503, 'service-unavailable');
      return rows.data;
    },
    async recordHostRun(input: RecordHostRun) {
      await staff();
      const parsed = RecordHostRunSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data,
        run = value.run;
      if (
        new TextEncoder().encode(JSON.stringify(run, null, 2)).byteLength > 58000 ||
        hasCredentialSignature(run)
      )
        throw new HttpFailure(400, 'invalid-request');
      const source = await submission(value.versionId);
      if (source.contentDigest !== value.expectedDigest) throw new HttpFailure(409, 'conflict');
      // Read the immutable server version; caller-provided definitions cannot bind evidence.
      let spec;
      try {
        spec = parseAgentSpecification(JSON.parse(source.specificationText));
      } catch {
        throw new HttpFailure(400, 'definition-incomplete');
      }
      const completed = Date.parse(run.completed_on + 'T00:00:00Z'),
        clock = now().getTime();
      if (
        !Number.isFinite(clock) ||
        completed > clock ||
        completed < clock - 90 * 86400000 ||
        !spec.platforms.some((platform) => platform.slug === run.platform_slug) ||
        (await contentChecksum(spec)) !== run.specification_sha256
      )
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_record_host_run', {
        record_id: value.recordId,
        submitted_version_id: value.versionId,
        expected_digest: value.expectedDigest,
        observation: run,
      });
      if (result.error) databaseFailure(result.error);
      const receipt = HostRunReceiptSchema.safeParse(result.data);
      if (
        !receipt.success ||
        receipt.data.id !== value.recordId ||
        receipt.data.versionId !== value.versionId ||
        receipt.data.contentDigest !== value.expectedDigest ||
        (await contentChecksum(receipt.data.run)) !== (await contentChecksum(run))
      )
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
  };
}
