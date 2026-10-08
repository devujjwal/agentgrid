import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  ForkInputSchema,
  ForkSourceSchema,
  ForkReceiptSchema,
  type ForkInput,
} from '../../src/domain/forks.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';
export function forkResources(client: SupabaseClient, member: () => Promise<{ id: string }>) {
  return {
    async forkSource(sourceVersionId: string) {
      await member();
      if (!z.uuid().safeParse(sourceVersionId).success)
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_fork_source', {
        source_version_id: sourceVersionId,
      });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const source = ForkSourceSchema.safeParse(result.data);
      if (!source.success || source.data.sourceVersionId !== sourceVersionId)
        throw new HttpFailure(503, 'service-unavailable');
      return source.data;
    },
    async forkAgent(input: ForkInput) {
      await member();
      const parsed = ForkInputSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_fork_agent', {
        source_version_id: value.sourceVersionId,
        requested_slug: value.slug,
        requested_name: value.name,
      });
      if (result.error) databaseFailure(result.error);
      const receipt = ForkReceiptSchema.safeParse(result.data);
      if (
        !receipt.success ||
        receipt.data.sourceVersionId !== value.sourceVersionId ||
        receipt.data.slug !== value.slug
      )
        throw new HttpFailure(503, 'service-unavailable');
      return receipt.data;
    },
  };
}
