'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { useOwnedReports } from './useOwnedReports';
import { reportCategoryLabels } from './categories';

export function OwnedReports() {
  const identity = useIdentity(),
    reports = useOwnedReports(identity.identity),
    memory = useCreatorMemory();
  const heading = useRef<HTMLHeadingElement>(null),
    requestedPage = useRef<number | null>(null);
  useEffect(() => {
    if (reports.history && requestedPage.current === reports.history.offset) {
      heading.current?.focus();
      requestedPage.current = null;
    }
  }, [reports.history]);
  if (identity.pending || reports.pending)
    return <p role="status">Verifying your private report history…</p>;
  if (identity.error || reports.error)
    return (
      <section className="identity-panel">
        <h2>Report history could not be opened.</h2>
        <p role="alert">{identity.error ?? reports.error}</p>
        <button
          className="action-secondary"
          onClick={() => (identity.error ? identity.reload() : reports.reload())}
        >
          Reconnect
        </button>
        <Link prefetch={false} href="/workspace/">
          Open your workspace
        </Link>
      </section>
    );
  if (!identity.identity?.signedIn)
    return (
      <section className="identity-panel">
        <h2>Private to your account.</h2>
        <p>Sign in to see concerns you raised and their current status.</p>
        <Link
          className="action-primary"
          prefetch={false}
          href="/sign-in/?returnTo=%2Fworkspace%2Freports%2F"
          target={memory.hasUnsaved ? '_blank' : undefined}
          rel="noopener noreferrer"
        >
          Connect to AgentGrid
        </Link>
      </section>
    );
  const history = reports.history;
  if (!history) return <p role="alert">Your reports are unavailable.</p>;
  function page(offset: number) {
    requestedPage.current = offset;
    reports.changeOffset(offset);
  }
  return (
    <section className="report-history" aria-labelledby="report-history-title">
      <p className="eyebrow">Private / moderation status</p>
      <h2 id="report-history-title" ref={heading} tabIndex={-1}>
        The concerns you raised.
      </h2>
      <button
        className="action-secondary"
        onClick={() => {
          requestedPage.current = history.offset;
          reports.reload();
        }}
      >
        Refresh status
      </button>
      {history.reports.length === 0 ? (
        <p>
          You have not sent any reports. Use “Report a concern” on a public resource when something
          needs attention.
        </p>
      ) : (
        <ol className="report-timeline">
          {history.reports.map((report) => (
            <li key={report.id}>
              <header>
                <h3>{reportCategoryLabels[report.category]}</h3>
                <span className="report-state">
                  {report.state === 'open' ? 'Awaiting moderation' : report.state}
                </span>
              </header>
              <p>
                Concern about{' '}
                {report.targetKind === 'agent'
                  ? 'an agent'
                  : report.targetKind === 'review'
                    ? 'a review'
                    : 'a creator profile'}{' '}
                · sent{' '}
                <time dateTime={report.createdAt}>
                  {new Date(report.createdAt).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </p>
              <p className="report-explanation">{report.explanation}</p>
              {report.resolvedAt && (
                <div className="report-resolution">
                  <h4>Moderation response</h4>
                  <p>{report.resolution}</p>
                  <p>
                    Recorded{' '}
                    <time dateTime={report.resolvedAt}>
                      {new Date(report.resolvedAt).toLocaleDateString('en', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </p>
                </div>
              )}
              <details>
                <summary>Report reference</summary>
                <dl>
                  <dt>Receipt</dt>
                  <dd>
                    <code>{report.id}</code>
                  </dd>
                  <dt>Reported resource reference</dt>
                  <dd>
                    <code>{report.targetId}</code>
                  </dd>
                </dl>
              </details>
            </li>
          ))}
        </ol>
      )}
      {(history.offset > 0 || history.hasMore) && (
        <nav aria-label="Report history pages">
          <button
            className="action-secondary"
            disabled={history.offset === 0}
            onClick={() => page(Math.max(0, history.offset - 20))}
          >
            Previous
          </button>
          <button
            className="action-secondary"
            disabled={!history.hasMore || history.offset + 20 > 9999}
            onClick={() => page(history.offset + 20)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
