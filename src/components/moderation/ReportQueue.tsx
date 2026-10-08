'use client';
import { useEffect, useRef, useState } from 'react';
import {
  StaffReportQueueSchema,
  type StaffReportQueue,
  type ReportQueueState,
} from '../../domain/report-moderation';
import { communityRequest } from '../../services/community';
import { reportCategoryLabels } from '../reporting/categories';

export function ReportQueue({ select }: { select: (id: string) => void }) {
  const [state, setState] = useState<ReportQueueState>('open'),
    [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null),
    refocus = useRef(false);
  const [snapshot, setSnapshot] = useState<{
    state: ReportQueueState;
    offset: number;
    retry: number;
    data: StaffReportQueue | null;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      `/api/moderation/reports/?state=${state}&offset=${offset}`,
      StaffReportQueueSchema,
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
        <label htmlFor="report-queue-state">
          Show reports
          <select
            id="report-queue-state"
            value={state}
            onChange={(e) => {
              refocus.current = true;
              setState(e.target.value as ReportQueueState);
              setOffset(0);
            }}
          >
            <option value="open">Open concerns</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
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
          Refresh reports
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        {state === 'open'
          ? 'Ready for investigation.'
          : state === 'resolved'
            ? 'Resolved concerns.'
            : 'Dismissed concerns.'}
      </h2>
      <p>
        Oldest reports first. Reporter details and captured content stay inside the private
        investigation.
      </p>
      {!current && <p role="status">Loading live report queue…</p>}
      {current?.error && <p role="alert">{current.error}</p>}
      {current?.data && (
        <>
          {current.data.reports.length === 0 ? (
            <div className="moderation-notice">
              <h3>{offset ? 'No more reports on this page.' : 'No reports in this queue.'}</h3>
              <p>Refresh to check for new concerns or choose another state.</p>
            </div>
          ) : (
            <ol className="moderation-rows" start={offset + 1}>
              {current.data.reports.map((report, index) => (
                <li key={report.id}>
                  <div>
                    <p className="eyebrow">
                      {report.targetKind} / {report.state}
                    </p>
                    <h3>{reportCategoryLabels[report.category]}</h3>
                    <p>
                      Received{' '}
                      <time dateTime={report.createdAt}>
                        {new Date(report.createdAt).toLocaleDateString('en-GB', {
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
                    onClick={() => select(report.id)}
                    aria-label={`Investigate report ${offset + index + 1}: ${reportCategoryLabels[report.category]}`}
                  >
                    Investigate <span aria-hidden="true">↗</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <nav className="moderation-toolbar" aria-label="Report queue pages">
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
