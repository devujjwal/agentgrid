'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { PublicReviews as ReviewBatch } from '../../domain/reviews';
import { readPublicReviews } from '../../services/public-community';
import { PublicReviewRow } from './PublicReviewRow';
import { ReviewReaderHeading } from './ReviewReaderHeading';

const ReviewEditor = dynamic(() => import('./ReviewEditor').then((module) => module.ReviewEditor), {
  loading: () => <p role="status">Opening review access…</p>,
});
export function PublicReviews({
  resourceId,
  label,
  path,
}: {
  resourceId: string;
  label: string;
  path: string;
}) {
  const [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0),
    [editing, setEditing] = useState(false),
    [engaged, setEngaged] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    requestedFocus = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    resourceId: string;
    offset: number;
    retry: number;
    batch: ReviewBatch | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const resume = () => setRetry((value) => value + 1);
    const visibility = () => {
      if (document.hidden) {
        controller.abort();
        setSnapshot(null);
      } else resume();
    };
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', restored);
    if (!document.hidden)
      void readPublicReviews(resourceId, offset, controller.signal).then(
        (batch) => {
          if (!controller.signal.aborted)
            setSnapshot({ resourceId, offset, retry, batch, error: null });
        },
        () => {
          if (!controller.signal.aborted)
            setSnapshot({
              resourceId,
              offset,
              retry,
              batch: null,
              error:
                'Live reviews could not be confirmed. This resource may be unavailable, or the connection was interrupted.',
            });
        },
      );
    return () => {
      controller.abort();
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', restored);
    };
  }, [resourceId, offset, retry]);
  const current =
    snapshot?.resourceId === resourceId && snapshot.offset === offset && snapshot.retry === retry
      ? snapshot
      : null;
  useEffect(() => {
    if (current && requestedFocus.current) {
      heading.current?.focus();
      requestedFocus.current = false;
    }
  }, [current]);
  function refresh() {
    requestedFocus.current = true;
    setRetry((value) => value + 1);
  }
  function page(value: number) {
    requestedFocus.current = true;
    setOffset(value);
  }
  const batch = current?.batch;
  return (
    <>
      <ReviewReaderHeading heading={heading} refresh={refresh} pending={!current} />
      <button
        className="action-secondary"
        aria-expanded={editing}
        aria-controls={'your-review-' + resourceId}
        onClick={() => {
          setEngaged(true);
          setEditing((value) => !value);
        }}
      >
        {editing ? 'Close your review' : 'Write or manage your review'}
      </button>
      <div id={'your-review-' + resourceId} hidden={!editing}>
        {engaged && (
          <ReviewEditor
            resourceId={resourceId}
            label={label}
            path={path}
            changed={() => setRetry((value) => value + 1)}
          />
        )}
      </div>
      <div className="review-live-feed" aria-busy={!current}>
        {!current && <p role="status">Reading live reviews…</p>}
        {current?.error && <p role="alert">{current.error}</p>}
        {batch && (
          <>
            <div className="review-aggregate">
              {batch.averageRating === null ? (
                <p>No public rating yet.</p>
              ) : (
                <p>
                  <strong>{batch.averageRating.toFixed(2)}</strong> / 5 · {batch.reviewCount}{' '}
                  {batch.reviewCount === 1 ? 'review' : 'reviews'}
                </p>
              )}
              <span className="review-signal" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </div>
            {batch.reviews.length === 0 ? (
              <p>
                {batch.offset === 0
                  ? 'No approved reviews are visible yet. Used this agent? Share what worked and where it fell short.'
                  : 'There are no visible reviews on this page. Return to the previous page or refresh.'}
              </p>
            ) : (
              <ol className="review-ledger">
                {batch.reviews.map((review) => (
                  <PublicReviewRow key={review.id} review={review} path={path} />
                ))}
              </ol>
            )}
            {(batch.offset > 0 || batch.hasMore) && (
              <nav aria-label="Public review pages">
                <button
                  className="action-secondary"
                  disabled={batch.offset === 0}
                  onClick={() => page(Math.max(0, batch.offset - 20))}
                >
                  Previous reviews
                </button>
                <button
                  className="action-secondary"
                  disabled={!batch.hasMore || batch.offset + 20 > 9999}
                  onClick={() => page(batch.offset + 20)}
                >
                  Next reviews
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </>
  );
}
