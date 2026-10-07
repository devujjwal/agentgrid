import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ReportDecisionSchema,
  ReportQueueStateSchema,
  StaffReportSchema,
  StaffReportSummarySchema,
  StaffReportQueueSchema,
  type ReportDecision,
  type ReportQueueState,
} from '../../src/domain/report-moderation.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from './failure.ts';

export function reportModerationResources(client: SupabaseClient, staff: () => Promise<void>) {
  return {
    async reportQueue(state: ReportQueueState, offset: number) {
      await staff();
      if (
        !ReportQueueStateSchema.safeParse(state).success ||
        !Number.isInteger(offset) ||
        offset < 0 ||
        offset > 9999
      )
        throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_reports', {
        requested_state: state,
        requested_offset: offset,
      });
      if (result.error) databaseFailure(result.error);
      const rows = z.array(StaffReportSummarySchema).max(21).safeParse(result.data);
      if (
        !rows.success ||
        rows.data.some((row) => row.state !== state) ||
        new Set(rows.data.map((row) => row.id)).size !== rows.data.length
      )
        throw new HttpFailure(503, 'service-unavailable');
      return StaffReportQueueSchema.parse({
        state,
        reports: rows.data.slice(0, 20),
        hasMore: rows.data.length > 20,
        offset,
      });
    },
    async staffReport(reportId: string) {
      await staff();
      if (!z.uuid().safeParse(reportId).success) throw new HttpFailure(400, 'invalid-request');
      const result = await client.rpc('agentgrid_staff_report', { report_resource_id: reportId });
      if (result.error) databaseFailure(result.error);
      if (result.data === null) throw new HttpFailure(404, 'not-found');
      const parsed = StaffReportSchema.safeParse(result.data);
      if (!parsed.success || parsed.data.id !== reportId)
        throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async decideReport(input: ReportDecision) {
      await staff();
      const parsed = ReportDecisionSchema.safeParse(input);
      if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
      const value = parsed.data;
      const result = await client.rpc('agentgrid_decide_report', {
        report_resource_id: value.reportId,
        decision: value.decision,
        explanation: value.explanation,
      });
      if (result.error) databaseFailure(result.error);
      const confirmed = StaffReportSchema.safeParse(result.data);
      if (
        !confirmed.success ||
        confirmed.data.id !== value.reportId ||
        confirmed.data.state !== value.decision ||
        confirmed.data.resolution !== value.explanation
      )
        throw new HttpFailure(503, 'service-unavailable');
      return confirmed.data;
    },
  };
}
