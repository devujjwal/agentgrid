'use client';
import {
  RejectSubmissionSchema,
  type RejectSubmission,
  type StaffSubmission,
} from '../../domain/submission-moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function SubmissionRejectionForm({
  submission,
  explanation,
  changeNotes,
  busy,
  uncertain,
  submit,
}: {
  submission: StaffSubmission;
  explanation: string;
  changeNotes: (value: { explanation: string }) => void;
  busy: boolean;
  uncertain: boolean;
  submit: (value: RejectSubmission) => void;
}) {
  const blocked = submission.state !== 'pending' || submission.authorIsSelf;
  const parsed = RejectSubmissionSchema.safeParse({
    versionId: submission.versionId,
    expectedDigest: submission.contentDigest,
    explanation,
  });
  return (
    <section className="moderation-decision" aria-labelledby="rejection-title">
      <p className="eyebrow">Creator feedback / exact submitted version</p>
      <h2 id="rejection-title">Explain what needs to change.</h2>
      <p>
        Give specific, actionable feedback. The creator can read this response and submit a new
        version. Keep private investigation details and personal information out of it.
      </p>
      {submission.authorIsSelf && (
        <p role="alert">This is your own submission. An uninvolved moderator must review it.</p>
      )}
      {submission.state !== 'pending' && (
        <p role="status">
          This submission is {submission.state}. Its recorded decision cannot be overwritten.
        </p>
      )}
      <fieldset className="moderation-fields" disabled={busy || uncertain || blocked}>
        <legend>Rejection feedback</legend>
        <label htmlFor="submission-rejection-notes">Response to the creator</label>
        <textarea
          id="submission-rejection-notes"
          rows={6}
          value={explanation}
          minLength={20}
          maxLength={2400}
          aria-describedby="submission-rejection-help"
          onChange={(event) => changeNotes({ explanation: event.target.value })}
        />
        <p id="submission-rejection-help">
          20–2,400 characters. Describe the issue, where it appears and how the creator can address
          it.
        </p>
      </fieldset>
      <ConfirmAction
        label={busy ? 'Recording rejection…' : 'Review and confirm rejection'}
        title={`Reject version ${submission.version}?`}
        description="This records your feedback against the exact submitted content and creates an immutable staff audit entry. The creator must submit a new version for another review."
        confirmation="Reject this version"
        disabled={busy || uncertain || blocked || !parsed.success}
        confirm={() => {
          if (parsed.success) submit(parsed.data);
        }}
      />
    </section>
  );
}
