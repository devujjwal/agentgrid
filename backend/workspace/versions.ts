import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  OwnedVersionSchema,
  OwnedVersionsSchema,
  VersionNumberSchema,
} from '../../src/domain/versions.ts';
import { parseAgentSpecification } from '../../src/domain/agent-specification.ts';
import type { draftResources } from './drafts.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

const HistoryProjection = z
  .strictObject({
    versions: z.array(OwnedVersionSchema).max(21),
    submissionEnabled: z.boolean(),
    pendingVersionId: z.uuid().nullable(),
    latestVersion: VersionNumberSchema.nullable(),
  })
  .refine(
    (value) => new Set(value.versions.map((version) => version.id)).size === value.versions.length,
  );
export function versionResources(
  client: SupabaseClient,
  member: () => Promise<{ id: string }>,
  drafts: ReturnType<typeof draftResources>,
) {
  async function history(resourceId: string, offset: number) {
    await member();
    const result = await client.rpc('agentgrid_owned_versions', {
      resource_id: resourceId,
      requested_offset: offset,
    });
    if (result.error) databaseFailure(result.error);
    const parsed = HistoryProjection.safeParse(result.data);
    if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
    return OwnedVersionsSchema.parse({
      ...parsed.data,
      versions: parsed.data.versions.slice(0, 20),
      hasMore: parsed.data.versions.length > 20,
      offset,
    });
  }
  async function ownedVersion(resourceId: string, versionId: string, profileId: string) {
    // Supplement RLS with explicit ownership even when a staff member uses the
    // creator API. History never accepts a client-selected profile or role.
    const result = await client
      .from('agentgrid_agent_versions')
      .select('id,agent_id,submitted_by,version,content_digest,created_at')
      .eq('id', versionId)
      .eq('agent_id', resourceId)
      .eq('submitted_by', profileId)
      .maybeSingle();
    if (result.error) databaseFailure(result.error);
    if (!result.data) throw new HttpFailure(404, 'not-found');
    const submission = await client
      .from('agentgrid_submissions')
      .select('state,reason,reviewed_at')
      .eq('version_id', versionId)
      .maybeSingle();
    if (submission.error) databaseFailure(submission.error);
    const parsed = OwnedVersionSchema.safeParse({
      id: result.data.id,
      version: result.data.version,
      contentDigest: result.data.content_digest,
      submittedAt: result.data.created_at,
      state: submission.data?.state,
      reason: submission.data?.reason,
      reviewedAt: submission.data?.reviewed_at,
    });
    if (
      !parsed.success ||
      result.data.agent_id !== resourceId ||
      result.data.submitted_by !== profileId ||
      parsed.data.id !== versionId
    )
      throw new HttpFailure(503, 'service-unavailable');
    return parsed.data;
  }
  return {
    versions: history,
    async submitVersion(resourceId: string, expectedRevision: number) {
      const profile = await member();
      const current = await drafts.draft(resourceId);
      if (current.status !== 'active') throw new HttpFailure(403, 'request-refused');
      if (current.revision !== expectedRevision) throw new HttpFailure(409, 'conflict');
      try {
        parseAgentSpecification(current.specification);
        if (
          current.specification.license.identifier === 'unselected' ||
          !current.specification.license.permissions.use
        )
          throw new Error('Explicit use terms required');
      } catch {
        throw new HttpFailure(400, 'definition-incomplete');
      }
      // PostgreSQL rechecks ownership, active membership, enabling, revision,
      // pending-review uniqueness and strictly increasing immutable versions.
      const result = await client.rpc('agentgrid_submit_version', {
        resource_id: resourceId,
        expected_revision: expectedRevision,
      });
      if (result.error) databaseFailure(result.error);
      const id = z.uuid().safeParse(result.data);
      if (!id.success) throw new HttpFailure(503, 'service-unavailable');
      const confirmed = await ownedVersion(resourceId, id.data, profile.id);
      if (confirmed.version !== current.specification.version || confirmed.state !== 'pending')
        throw new HttpFailure(503, 'service-unavailable');
      return confirmed;
    },
    async withdrawVersion(resourceId: string, versionId: string, reason: string) {
      const profile = await member();
      // Require an owned resource and version; staff review authority is not
      // interchangeable with the creator's deliberate withdrawal action.
      await drafts.draft(resourceId);
      const current = await ownedVersion(resourceId, versionId, profile.id);
      if (current.state !== 'pending') throw new HttpFailure(409, 'conflict');
      const result = await client.rpc('agentgrid_decide_submission', {
        submitted_version_id: versionId,
        decision: 'withdrawn',
        explanation: reason,
      });
      if (result.error) databaseFailure(result.error);
      const confirmed = await ownedVersion(resourceId, versionId, profile.id);
      if (confirmed.state !== 'withdrawn') throw new HttpFailure(503, 'service-unavailable');
      return confirmed;
    },
  };
}
