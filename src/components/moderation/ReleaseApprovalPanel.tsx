'use client';
import { useEffect, useRef } from 'react';
import type { StaffSubmission } from '../../domain/submission-moderation';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { emptyReleaseReview, ReleaseReviewForm } from './ReleaseReviewForm';
import { ReleaseRequestList } from './ReleaseRequestList';
import { useReleaseApproval } from './useReleaseApproval';
export default function ReleaseApprovalPanel({
  submission,
  email,
  csrf,
}: {
  submission: StaffSubmission;
  email: string;
  csrf: string;
}) {
  const {
    memory,
    setRetry,
    busy,
    uncertain,
    message,
    setMessage,
    error,
    setError,
    current,
    data,
    held,
    buffer,
    recorded,
    mutate,
    binding,
    changed,
    disabled,
  } = useReleaseApproval({ submission, email, csrf });
  const notice = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message || error) notice.current?.focus();
  }, [message, error]);
  return (
    <section
      className="moderation-context"
      aria-labelledby="release-review-title"
      aria-busy={busy || !current}
    >
      <h3 id="release-review-title">Publication review</h3>
      <p>
        A staff review selects evidence for this exact version. Recording a request does not publish
        a page or bypass the quality gate.
      </p>
      <button
        className="action-secondary"
        disabled={busy || !current}
        onClick={() => {
          setError(null);
          setMessage(null);
          setRetry((v) => v + 1);
        }}
      >
        Refresh publication status
      </button>
      {!current && <p role="status">Checking release state and selected-version evidence…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {error && (
        <p ref={notice} tabIndex={-1} role="alert">
          {error}
        </p>
      )}
      {message && (
        <p ref={notice} tabIndex={-1} role="status" className="moderation-receipt">
          {message}
        </p>
      )}
      {data && (
        <>
          <ReleaseRequestList
            approvals={data.requests.approvals}
            busy={busy || uncertain}
            cancel={(id) => void mutate(id)}
          />
          {held && !buffer ? (
            <>
              <p>An unsaved publication review for another version is held in this tab.</p>
              <ConfirmAction
                label="Discard other review"
                title="Discard the held publication review?"
                description="The unsaved selections and rationale will be discarded. Recorded requests stay unchanged."
                confirmation="Discard unsaved review"
                confirm={() => memory.setReleaseReview(null)}
              />
            </>
          ) : recorded ? (
            <>
              <p role="status">
                A request with this reference is recorded above. Inspect its state and rationale
                before starting another review.
              </p>
              <button className="action-secondary" onClick={() => memory.setReleaseReview(null)}>
                Start another review
              </button>
            </>
          ) : (
            <ReleaseReviewForm
              value={buffer?.draft ?? emptyReleaseReview()}
              change={(draft) =>
                memory.setReleaseReview({
                  email,
                  versionId: submission.versionId,
                  draft,
                  binding: buffer?.binding ?? binding!,
                })
              }
              runs={data.evidence.runs}
              binding={buffer?.binding ?? binding!}
              disabled={disabled}
              selfReview={submission.authorIsSelf}
              submit={(input) => void mutate(input)}
            />
          )}
          {buffer && !recorded && (
            <ConfirmAction
              label="Discard unsaved publication review"
              title="Discard this unsaved review?"
              description="The selections, confirmations and rationale held in this tab will be discarded. Recorded publication requests remain unchanged."
              confirmation="Discard unsaved review"
              disabled={busy || uncertain}
              confirm={() => memory.setReleaseReview(null)}
            />
          )}
          {changed && buffer && binding && (
            <>
              <p role="alert">
                The agent state changed since you began this review. Inspect the current agent
                access and release before reconfirming your review.
              </p>
              <ConfirmAction
                label="Review updated state"
                title="Recheck this review against the updated state?"
                description="Your notes and evidence selections are retained. All six staff confirmations are cleared so you can review the current state before requesting publication."
                confirmation="Reset confirmations for updated state"
                disabled={busy}
                confirm={() =>
                  memory.setReleaseReview({
                    ...buffer,
                    binding,
                    draft: {
                      ...buffer.draft,
                      requestId: crypto.randomUUID(),
                      checks: emptyReleaseReview().checks,
                    },
                  })
                }
              />
            </>
          )}
          {disabled && !busy && !uncertain && !changed && (
            <p role="status">
              A new request requires a pending version, active agent and owner, and fewer than 20
              recorded requests for this version.
            </p>
          )}
        </>
      )}
    </section>
  );
}
