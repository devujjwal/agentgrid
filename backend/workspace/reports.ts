import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  OwnedReportSchema,
  OwnedReportsSchema,
  ReportInputSchema,
  type ReportInput,
} from '../../src/domain/reports.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

const Projection = z
  .array(OwnedReportSchema)
  .max(21)
  .refine((rows) => new Set(rows.map((row) => row.id)).size === rows.length);
export function reportResources(client: SupabaseClient, member: () => Promise<unknown>) {
  async function owned(offset: number, reportId: string | null = null) {
    await member();
    // The RPC independently checks active membership and current ownership in
    // the read transaction. Staff authority cannot broaden this creator API.
    const result = await client.rpc('agentgrid_owned_reports', {
      requested_offset: offset,
      report_resource_id: reportId,
    });
    if (result.error) databaseFailure(result.error);
    const rows = Projection.safeParse(result.data);
    if (!rows.success) throw new HttpFailure(503, 'service-unavailable');
    return rows.data;
  }
  return {
    async reports(offset: number) {
      const rows = await owned(offset);
      return OwnedReportsSchema.parse({
        reports: rows.slice(0, 20),
        hasMore: rows.length > 20,
        offset,
      });
    },
    async createReport(input: ReportInput) {
      await member();
      const parsed = ReportInputSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_create_report', {
        target_kind: value.targetKind,
        target_id: value.targetId,
        report_category: value.category,
        details: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      const id = z.uuid().safeParse(result.data);
      if (!id.success) throw new HttpFailure(503, 'service-unavailable');
      const rows = await owned(0, id.data),
        confirmed = rows[0];
      if (
        rows.length !== 1 ||
        !confirmed ||
        confirmed.id !== id.data ||
        confirmed.targetKind !== value.targetKind ||
        confirmed.targetId !== value.targetId ||
        confirmed.category !== value.category ||
        confirmed.explanation !== value.explanation
      )
        throw new HttpFailure(503, 'service-unavailable');
      // Return actual live state: a staff resolution may race the acknowledgement.
      return confirmed;
    },
  };
}
