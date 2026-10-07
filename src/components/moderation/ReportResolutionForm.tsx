'use client';
import { useState } from 'react';
import {
  ReportDecisionSchema,
  type ReportDecision,
  type StaffReport,
} from '../../domain/report-moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function ReportResolutionForm({
  report,
  explanation,
  changeNotes,
  busy,
  uncertain,
  submit,
}: {
  report: StaffReport;
  explanation: string;
  changeNotes: (value: { explanation: string }) => void;
  busy: boolean;
  uncertain: boolean;
  submit: (value: ReportDecision) => void;
}) {
  const [decision, setDecision] = useState<'resolved' | 'dismissed'>('resolved');
  const blocked = report.state !== 'open' || report.conflictOfInterest;
  const parsed = ReportDecisionSchema.safeParse({ reportId: report.id, decision, explanation });
  return (
    <section className="moderation-decision" aria-labelledby="resolution-title">
      <p className="eyebrow">Final response / shared with the reporter</p>
      <h2 id="resolution-title">Record the outcome.</h2>
      <p>
        Complete the investigation and any necessary resource changes before closing. Describe the
        result clearly. The reporter can read this response; keep confidential evidence and personal
        information out of it.
      </p>
      {report.conflictOfInterest && (
        <p role="alert">
          You submitted this report or own its target. An uninvolved moderator must record the
          outcome.
        </p>
      )}
      {report.state !== 'open' && (
        <p role="status">
          This report is already {report.state}. Its recorded resolution cannot be overwritten.
        </p>
      )}
      <fieldset className="moderation-fields" disabled={busy || uncertain || blocked}>
        <legend>Investigation outcome</legend>
        <label className="moderation-choice">
          <input
            name="report-decision"
            type="radio"
            checked={decision === 'resolved'}
            onChange={() => setDecision('resolved')}
          />
          Resolved — concern addressed
        </label>
        <label className="moderation-choice">
          <input
            name="report-decision"
            type="radio"
            checked={decision === 'dismissed'}
            onChange={() => setDecision('dismissed')}
          />
          Dismissed — no action warranted
        </label>
        <label htmlFor="report-resolution-notes">Response to the reporter</label>
        <textarea
          id="report-resolution-notes"
          rows={6}
          value={explanation}
          minLength={20}
          maxLength={2400}
          aria-describedby="report-resolution-help"
          onChange={(event) => changeNotes({ explanation: event.target.value })}
        />
        <p id="report-resolution-help">
          20–2,400 characters. State what was checked, the outcome and any useful next step.
        </p>
      </fieldset>
      <ConfirmAction
        label={busy ? 'Recording resolution…' : 'Review and confirm resolution'}
        title={decision === 'resolved' ? 'Close this report as resolved?' : 'Dismiss this report?'}
        description="This records a final response for the reporter and an immutable staff audit entry. Closing a report does not perform resource changes. Check that any necessary action is complete first."
        confirmation={decision === 'resolved' ? 'Record resolution' : 'Record dismissal'}
        disabled={busy || uncertain || blocked || !parsed.success}
        confirm={() => {
          if (parsed.success) submit(parsed.data);
        }}
      />
    </section>
  );
}
