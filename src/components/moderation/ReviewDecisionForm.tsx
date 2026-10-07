'use client';
import { useRef, useState } from 'react';
import {
  ReviewDecisionSchema,
  type ReviewDecision,
  type StaffReview,
} from '../../domain/moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
export interface DecisionNotes {
  explanation: string;
  revision: number;
  decisionRevision: number;
}

export function ReviewDecisionForm({
  review,
  notes,
  changeNotes,
  busy,
  uncertain,
  submit,
}: {
  review: StaffReview;
  notes: DecisionNotes | null;
  changeNotes: (value: DecisionNotes | null) => void;
  busy: boolean;
  uncertain: boolean;
  submit: (value: ReviewDecision) => void;
}) {
  const explanationField = useRef<HTMLTextAreaElement>(null);
  const [decision, setDecision] = useState<'published' | 'hidden'>('hidden');
  const conflict =
    notes &&
    (notes.revision !== review.revision || notes.decisionRevision !== review.decisionRevision);
  const blocked = review.authorIsSelf || review.state === 'withdrawn';
  const input = {
    reviewId: review.id,
    expectedRevision: review.revision,
    expectedDecisionRevision: review.decisionRevision,
    decision,
    explanation: notes?.explanation ?? '',
  };
  const valid = ReviewDecisionSchema.safeParse(input);
  return (
    <section className="moderation-decision" aria-labelledby="decision-title">
      <p className="eyebrow">Recorded decision</p>
      <h2 id="decision-title">Explain the next step.</h2>
      <p>
        Your explanation is visible to the review author and authorized staff. Do not include
        confidential reports or personal information. Notes stay in this tab while you inspect this
        review.
      </p>
      {review.authorIsSelf && (
        <p role="alert">
          You cannot moderate your own review. Another appointed moderator must handle it.
        </p>
      )}
      {review.state === 'withdrawn' && (
        <p role="status">
          The author withdrew this review. Staff cannot restore it; the author must resubmit.
        </p>
      )}
      {(!review.resourceAvailable || !review.authorActive) && (
        <p role="status">
          This review cannot be approved while its resource or author is unavailable.
        </p>
      )}
      {conflict && !blocked && (
        <div className="moderation-notice" role="alert">
          <p>
            The content or staff decision changed since you began these notes. Compare the latest
            review and decision above before continuing.
          </p>
          <ConfirmAction
            label="Apply notes to the latest revision"
            title="Use these notes for the current review?"
            description="Confirm that you have compared the current review and existing decision. Your explanation will be kept; publishing or hiding still requires a separate confirmation."
            confirmation="Keep notes for current revision"
            confirm={() => {
              changeNotes({
                explanation: notes.explanation,
                revision: review.revision,
                decisionRevision: review.decisionRevision,
              });
              explanationField.current?.focus();
            }}
          />
        </div>
      )}
      <fieldset disabled={busy || blocked || uncertain} className="moderation-fields">
        <legend>Review outcome</legend>
        <label className="moderation-choice">
          <input
            type="radio"
            name="review-decision"
            checked={decision === 'hidden'}
            onChange={() => setDecision('hidden')}
          />
          Hide from public feedback
        </label>
        <label className="moderation-choice">
          <input
            type="radio"
            name="review-decision"
            checked={decision === 'published'}
            disabled={!review.resourceAvailable || !review.authorActive}
            onChange={() => setDecision('published')}
          />
          Approve for public display
        </label>
        <label htmlFor="review-decision-notes">Explanation to the author</label>
        <textarea
          id="review-decision-notes"
          ref={explanationField}
          rows={6}
          minLength={20}
          maxLength={2400}
          value={notes?.explanation ?? ''}
          aria-describedby="decision-notes-help"
          onChange={(event) =>
            changeNotes({
              explanation: event.target.value,
              revision: notes?.revision ?? review.revision,
              decisionRevision: notes?.decisionRevision ?? review.decisionRevision,
            })
          }
        />
        <p id="decision-notes-help">
          20–2,400 characters. Describe the specific reason and, when useful, how the author can
          address it.
        </p>
      </fieldset>
      <ConfirmAction
        label={busy ? 'Recording decision…' : 'Review and confirm decision'}
        title={
          decision === 'published'
            ? 'Approve this review for display?'
            : 'Hide this review from public feedback?'
        }
        description={`This records a ${decision === 'published' ? 'publication' : 'hide'} decision for “${review.title}”, content revision ${review.revision}. Your explanation will be shared with the author. The server will reject an outdated decision.`}
        confirmation={decision === 'published' ? 'Approve review' : 'Hide review'}
        disabled={
          busy ||
          uncertain ||
          blocked ||
          Boolean(conflict) ||
          !valid.success ||
          (decision === 'published' && (!review.resourceAvailable || !review.authorActive))
        }
        confirm={() => {
          if (valid.success) submit(valid.data);
        }}
      />
    </section>
  );
}
