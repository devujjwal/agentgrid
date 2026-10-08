import { parseDraftEditorial, type DraftEditorial } from '../../src/domain/draft-editorial.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  DraftRecordSchema,
  parseDraftSpecification,
  type DraftSpecification,
} from '../../src/domain/draft.ts';
import { assertJsonDocumentBounds } from '../../src/domain/agent-specification.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

export function draftResources(client: SupabaseClient, member: () => Promise<{ id: string }>) {
  const document = async (resourceId: string, profileId: string) => {
    // An explicit owner predicate supplements RLS even for staff accounts.
    const agent = await client
      .from('agentgrid_agents')
      .select('id,slug,status,forked_from_version_id')
      .eq('id', resourceId)
      .eq('owner_id', profileId)
      .maybeSingle();
    if (agent.error) databaseFailure(agent.error);
    if (!agent.data) throw new HttpFailure(404, 'not-found');
    const result = await client
      .from('agentgrid_drafts')
      .select('specification,editorial,revision,updated_at')
      .eq('agent_id', resourceId)
      .maybeSingle();
    if (result.error) databaseFailure(result.error);
    if (!result.data) throw new HttpFailure(404, 'not-found');
    try {
      assertJsonDocumentBounds(result.data.editorial);
      if (new TextEncoder().encode(JSON.stringify(result.data.editorial)).byteLength > 32_000)
        throw new Error('Editorial bounds');
      const record = DraftRecordSchema.parse({
        resourceId: agent.data.id,
        status: agent.data.status,
        sourceVersionId: agent.data.forked_from_version_id,
        specification: parseDraftSpecification(result.data.specification),
        editorial: result.data.editorial,
        revision: result.data.revision,
        updatedAt: result.data.updated_at,
      });
      if (record.specification.identity.slug !== agent.data.slug)
        throw new Error('Resource path mismatch');
      return record;
    } catch {
      throw new HttpFailure(503, 'service-unavailable');
    }
  };
  return {
    async draft(resourceId: string) {
      const profile = await member();
      return document(resourceId, profile.id);
    },
    async createDraft(specification: DraftSpecification) {
      const profile = await member();
      parseDraftSpecification(specification);
      const result = await client.rpc('agentgrid_create_agent', {
        requested_slug: specification.identity.slug,
        initial_specification: specification,
        source_version_id: null,
        initial_editorial: {},
      });
      if (result.error) databaseFailure(result.error);
      const parsed = z.uuid().safeParse(result.data);
      if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
      return document(parsed.data, profile.id);
    },
    async saveDraft(
      resourceId: string,
      expectedRevision: number,
      specification: DraftSpecification,
      editorial?: DraftEditorial,
    ) {
      const profile = await member();
      parseDraftSpecification(specification);
      let guide: DraftEditorial | null = null;
      if (editorial !== undefined) {
        try {
          guide = parseDraftEditorial(editorial);
        } catch {
          throw new HttpFailure(400, 'invalid-request');
        }
      }
      const current = await document(resourceId, profile.id);
      if (current.status !== 'active') throw new HttpFailure(403, 'request-refused');
      if (current.revision !== expectedRevision) throw new HttpFailure(409, 'conflict');
      if (current.specification.identity.slug !== specification.identity.slug)
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_save_draft', {
        resource_id: resourceId,
        expected_revision: expectedRevision,
        updated_specification: specification,
        updated_editorial: guide,
      });
      if (result.error) databaseFailure(result.error);
      if (result.data !== expectedRevision + 1) throw new HttpFailure(503, 'service-unavailable');
      // Return the acknowledged revision only. A competing subsequent save is
      // never accidentally presented as this user's edited document.
      return { revision: result.data };
    },
  };
}
