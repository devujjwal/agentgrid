'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { StaffReviewSchema, type StaffReview, type ReviewDecision } from '../../domain/moderation';
import { CommunityError, communityRequest } from '../../services/community';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { ReviewDecisionForm, type DecisionNotes } from './ReviewDecisionForm';

export function StaffReviewDetail({
  reviewId,
  csrf,
  notes,
  changeNotes,
  back,
  recheck,
}: {
  reviewId: string;
  csrf: string;
  notes: DecisionNotes | null;
  changeNotes: (value: DecisionNotes | null) => void;
  back: () => void;
  recheck: () => void;
}) {
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [receipt, setReceipt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    review: StaffReview | null;
    error: string | null;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    focus = useRef(true),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      '/api/moderation/review/?reviewId=' + reviewId,
      StaffReviewSchema,
      undefined,
      controller.signal,
    ).then(
      (review) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, review, error: null });
          setUncertain(false);
        }
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            review: null,
            error: failure instanceof Error ? failure.message : 'Review unavailable.',
          });
      },
    );
    return () => controller.abort();
  }, [reviewId, retry]);
  const current = snapshot?.retry === retry ? snapshot : null,
    review = current?.review;
  useEffect(() => {
    if (current && focus.current) {
      heading.current?.focus();
      focus.current = false;
    }
  }, [current]);
  const reload = () => {
    focus.current = true;
    setReceipt(null);
    setError(null);
    setRetry((value) => value + 1);
  };
  async function decide(input: ReviewDecision) {
    if (busy || uncertain || !review) return;
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      const saved = await communityRequest('/api/moderation/decision/', StaffReviewSchema, {
        csrf,
        body: input,
      });
      if (!mounted.current) return;
      changeNotes(null);
      setSnapshot({ retry, review: saved, error: null });
      setReceipt(
        `Decision recorded: ${saved.state === 'published' ? 'approved for public display' : 'hidden from public feedback'}. Decision revision ${saved.decisionRevision}.`,
      );
      focus.current = true;
    } catch (failure) {
      if (!mounted.current) return;
      const uncertainWrite =
        !(failure instanceof CommunityError) ||
        ![
          'invalid-request',
          'request-refused',
          'not-signed-in',
          'rate-limited',
          'conflict',
        ].includes(failure.code);
      setUncertain(true); // Conflicts also require fresh live review before retry.
      setError(
        uncertainWrite
          ? 'The decision may have been recorded, but confirmation did not arrive. Check live status before attempting another decision. Your notes are retained.'
          : failure instanceof CommunityError && failure.code === 'conflict'
            ? 'The review or another staff decision changed. Check live status and compare before continuing.'
            : failure instanceof Error
              ? failure.message + ' Check live status before continuing.'
              : 'Decision unavailable.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="moderation-detail" aria-busy={busy || !current}>
      <div className="moderation-toolbar">
        <Link prefetch={false} href="/workspace/">
          Your workspace ↗
        </Link>
        {notes?.explanation ? (
          <ConfirmAction
            label="Back to review queue"
            title="Leave these decision notes?"
            description="Your unsaved explanation will be discarded. Recorded moderation decisions stay unchanged."
            confirmation="Discard notes and return"
            disabled={busy}
            confirm={back}
          />
        ) : (
          <button className="action-secondary" disabled={busy} onClick={back}>
            ← Review queue
          </button>
        )}
        <button className="action-secondary" disabled={busy || !current} onClick={reload}>
          {uncertain ? 'Check live decision status' : 'Refresh review and decision'}
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        Review inspection
      </h2>
      {!current && <p role="status">Checking the current review and decision…</p>}
      {current?.error && (
        <div className="moderation-notice">
          <p role="alert">{current.error}</p>
          <button className="action-secondary" onClick={recheck}>
            Recheck staff access
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {receipt && (
        <p role="status" className="moderation-receipt">
          {receipt}
        </p>
      )}
      {review && (
        <>
          <article className="moderation-review">
            <p className="eyebrow">
              {review.resourceSlug} / {review.state}
            </p>
            <h3>{review.title}</h3>
            <dl className="moderation-facts">
              <div>
                <dt>Rating</dt>
                <dd>{review.rating} of 5</dd>
              </div>
              <div>
                <dt>Version used</dt>
                <dd>{review.version}</dd>
              </div>
              <div>
                <dt>Content revision</dt>
                <dd>{review.revision}</dd>
              </div>
              <div>
                <dt>Decision revision</dt>
                <dd>{review.decisionRevision}</dd>
              </div>
            </dl>
            <h4>Use context</h4>
            <p className="moderation-prose">{review.experience}</p>
            <h4>Review</h4>
            <p className="moderation-prose">{review.body}</p>
            {review.reviewedAt && (
              <aside className="moderation-existing">
                <h4>Existing staff explanation</h4>
                <p className="moderation-prose">{review.reason}</p>
                <p>
                  Recorded{' '}
                  <time dateTime={review.reviewedAt}>
                    {new Date(review.reviewedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
                  </time>
                </p>
              </aside>
            )}
          </article>
          <ReviewDecisionForm
            review={review}
            notes={notes}
            changeNotes={changeNotes}
            busy={busy}
            uncertain={uncertain}
            submit={(value) => void decide(value)}
          />
        </>
      )}
    </div>
  );
}
