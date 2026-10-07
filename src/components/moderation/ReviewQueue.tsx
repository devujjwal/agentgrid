'use client';
import { useEffect, useRef, useState } from 'react';
import {
  StaffReviewQueueSchema,
  type StaffReviewQueue,
  type ReviewQueueState,
} from '../../domain/moderation';
import { communityRequest } from '../../services/community';

export function ReviewQueue({ select }: { select: (id: string) => void }) {
  const [state, setState] = useState<ReviewQueueState>('pending'),
    [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null),
    refocus = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    state: ReviewQueueState;
    offset: number;
    retry: number;
    data: StaffReviewQueue | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      `/api/moderation/reviews/?state=${state}&offset=${offset}`,
      StaffReviewQueueSchema,
      undefined,
      controller.signal,
    ).then(
      (data) => {
        if (!controller.signal.aborted) setSnapshot({ state, offset, retry, data, error: null });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            state,
            offset,
            retry,
            data: null,
            error: error instanceof Error ? error.message : 'Queue unavailable.',
          });
      },
    );
    return () => controller.abort();
  }, [state, offset, retry]);
  const current =
    snapshot?.state === state && snapshot.offset === offset && snapshot.retry === retry
      ? snapshot
      : null;
  useEffect(() => {
    if (current && refocus.current) {
      heading.current?.focus();
      refocus.current = false;
    }
  }, [current]);
  function page(value: number) {
    refocus.current = true;
    setOffset(value);
  }
  return (
    <section className="moderation-queue" aria-busy={!current}>
      <div className="moderation-toolbar">
        <label htmlFor="review-queue-state">
          Show reviews
          <select
            id="review-queue-state"
            value={state}
            onChange={(e) => {
              refocus.current = true;
              setState(e.target.value as ReviewQueueState);
              setOffset(0);
            }}
          >
            <option value="pending">Awaiting decision</option>
            <option value="published">Approved for display</option>
            <option value="hidden">Hidden by staff</option>
          </select>
        </label>
        <button
          className="action-secondary"
          onClick={() => {
            refocus.current = true;
            setRetry((value) => value + 1);
          }}
          disabled={!current}
        >
          Refresh queue
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {state === 'pending'
          ? 'Awaiting a careful review.'
          : state === 'published'
            ? 'Approved review decisions.'
            : 'Hidden review decisions.'}
      </h2>
      <p>
        Oldest submissions first. Each decision is checked against the latest content and moderation
        state.
      </p>
      {!current && <p role="status">Loading live review queue…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.data && (
        <>
          {current.data.reviews.length === 0 ? (
            <div className="moderation-notice">
              <h3>{offset ? 'No more reviews on this page.' : 'No reviews in this queue.'}</h3>
              <p>Refresh to check for new submissions or choose another review state.</p>
            </div>
          ) : (
            <ol className="moderation-rows" start={offset + 1}>
              {current.data.reviews.map((review) => (
                <li key={review.id}>
                  <div>
                    <p className="eyebrow">
                      {review.resourceSlug} / revision {review.revision}
                    </p>
                    <h3>{review.title}</h3>
                    <p>
                      <time dateTime={review.createdAt}>
                        {new Date(review.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </time>{' '}
                      · Decision revision {review.decisionRevision}
                    </p>
                  </div>
                  <button
                    className="action-secondary"
                    onClick={() => select(review.id)}
                    aria-label={`Inspect review: ${review.title}`}
                  >
                    Inspect review <span aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <nav className="moderation-toolbar" aria-label="Review queue pages">
            <button
              className="action-secondary"
              disabled={offset === 0}
              onClick={() => page(Math.max(0, offset - 20))}
            >
              Previous page
            </button>
            <p>Page {Math.floor(offset / 20) + 1}</p>
            <button
              className="action-secondary"
              disabled={!current.data.hasMore || offset + 20 > 9999}
              onClick={() => page(offset + 20)}
            >
              Next page
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
