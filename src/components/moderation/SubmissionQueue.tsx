'use client';
import { useEffect, useRef, useState } from 'react';
import {
  StaffSubmissionQueueSchema,
  type StaffSubmissionQueue,
} from '../../domain/submission-moderation';
import { communityRequest } from '../../services/community';
type SubmissionQueueState = StaffSubmissionQueue['state'];

export function SubmissionQueue({ select }: { select: (id: string) => void }) {
  const [state, setState] = useState<SubmissionQueueState>('pending'),
    [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null),
    refocus = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    state: SubmissionQueueState;
    offset: number;
    retry: number;
    data: StaffSubmissionQueue | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      `/api/moderation/submissions/?state=${state}&offset=${offset}`,
      StaffSubmissionQueueSchema,
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
        <label htmlFor="submission-queue-state">
          Show submissions
          <select
            id="submission-queue-state"
            value={state}
            onChange={(e) => {
              refocus.current = true;
              setState(e.target.value as SubmissionQueueState);
              setOffset(0);
            }}
          >
            <option value="pending">Pending review</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
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
          Refresh submissions
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {state === 'pending'
          ? 'Ready for a careful review.'
          : `${state.charAt(0).toUpperCase()}${state.slice(1)} submissions.`}
      </h2>
      <p>
        Oldest submissions first. Inspect each immutable version and its guide before making a
        decision.
      </p>
      {!current && <p role="status">Loading live submission queue…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.data && (
        <>
          {current.data.submissions.length === 0 ? (
            <div className="moderation-notice">
              <h3>
                {offset ? 'No more submissions on this page.' : 'No submissions in this queue.'}
              </h3>
              <p>Refresh to check for new submissions or choose another state.</p>
            </div>
          ) : (
            <ol className="moderation-rows" start={offset + 1}>
              {current.data.submissions.map((submission, index) => (
                <li key={submission.versionId}>
                  <div>
                    <p className="eyebrow">
                      Version {submission.version} / {submission.state}
                    </p>
                    <h3>{submission.name}</h3>
                    <p>
                      Received{' '}
                      <time dateTime={submission.submittedAt}>
                        {new Date(submission.submittedAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          timeZone: 'UTC',
                        })}
                      </time>
                    </p>
                  </div>
                  <button
                    className="action-secondary"
                    onClick={() => select(submission.versionId)}
                    aria-label={`Inspect version ${submission.version}, submission ${offset + index + 1}: ${submission.name}`}
                  >
                    Inspect version <span aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <nav className="moderation-toolbar" aria-label="Submission queue pages">
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
