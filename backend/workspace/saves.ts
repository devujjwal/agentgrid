import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { SavedListSchema, SaveStateSchema } from '../../src/domain/saves.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

export function savedResources(client: SupabaseClient, member: () => Promise<unknown>) {
  return {
    async saved(offset: number) {
      await member();
      const result = await client.rpc('agentgrid_saved_agents', { requested_offset: offset });
      if (result.error) databaseFailure(result.error);
      const base = { agent_id: z.uuid(), saved_at: z.iso.datetime({ offset: true }) };
      const rows = z
        .array(
          z.discriminatedUnion('available', [
            z.strictObject({
              ...base,
              available: z.literal(true),
              slug: z.string(),
              title: z.string(),
              summary: z.string(),
              category_slug: z.string(),
            }),
            z.strictObject({
              ...base,
              available: z.literal(false),
              slug: z.null(),
              title: z.null(),
              summary: z.null(),
              category_slug: z.null(),
            }),
          ]),
        )
        .max(21)
        .safeParse(result.data);
      if (!rows.success) throw new HttpFailure(503, 'service-unavailable');
      const parsed = SavedListSchema.safeParse({
        agents: rows.data.slice(0, 20).map((row) => ({
          resourceId: row.agent_id,
          savedAt: row.saved_at,
          resource: row.available
            ? {
                slug: row.slug,
                title: row.title,
                summary: row.summary,
                category: row.category_slug,
              }
            : null,
        })),
        hasMore: rows.data.length > 20,
        offset,
      });
      if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async saveState(resourceId: string) {
      await member();
      const result = await client.rpc('agentgrid_resource_save_state', { resource_id: resourceId });
      if (result.error) databaseFailure(result.error);
      const parsed = SaveStateSchema.safeParse(result.data);
      if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
  };
}
