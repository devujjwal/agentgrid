'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  StaffReportSchema,
  type StaffReport,
  type ReportDecision,
} from '../../domain/report-moderation';
import { CommunityError, communityRequest } from '../../services/community';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { reportCategoryLabels } from '../reporting/categories';
import { ReportContext } from './ReportContext';
import { ReportResolutionForm } from './ReportResolutionForm';

export function StaffReportDetail({
  reportId,
  csrf,
  notes,
  changeNotes,
  back,
  recheck,
}: {
  reportId: string;
  csrf: string;
  notes: { explanation: string } | null;
  changeNotes: (value: { explanation: string } | null) => void;
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
    report: StaffReport | null;
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
      '/api/moderation/report/?reportId=' + reportId,
      StaffReportSchema,
      undefined,
      controller.signal,
    ).then(
      (report) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, report, error: null });
          setUncertain(false);
        }
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            report: null,
            error: failure instanceof Error ? failure.message : 'Report unavailable.',
          });
      },
    );
    return () => controller.abort();
  }, [reportId, retry]);
  const current = snapshot?.retry === retry ? snapshot : null,
    report = current?.report;
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
  async function decide(input: ReportDecision) {
    if (busy || uncertain || !report) return;
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      const saved = await communityRequest('/api/moderation/resolution/', StaffReportSchema, {
        csrf,
        body: input,
      });
      if (!mounted.current) return;
      changeNotes(null);
      setSnapshot({ retry, report: saved, error: null });
      setReceipt(`Report ${saved.state}. The response is recorded and available to the reporter.`);
      focus.current = true;
    } catch (failure) {
      if (!mounted.current) return;
      setUncertain(true);
      setError(
        failure instanceof CommunityError && failure.code === 'conflict'
          ? 'Another moderator already closed this report. Check its live resolution before continuing.'
          : failure instanceof CommunityError &&
              ['invalid-request', 'request-refused', 'not-signed-in', 'rate-limited'].includes(
                failure.code,
              )
            ? failure.message + ' Check live status before continuing.'
            : 'The resolution may have been recorded, but confirmation did not arrive. Check live status before attempting another action. Your response is retained.',
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
            label="Back to report queue"
            title="Leave this response?"
            description="Your unsaved response will be discarded. Recorded report outcomes stay unchanged."
            confirmation="Discard response and return"
            disabled={busy}
            confirm={back}
          />
        ) : (
          <button className="action-secondary" disabled={busy} onClick={back}>
            ← Report queue
          </button>
        )}
        <button className="action-secondary" disabled={busy || !current} onClick={reload}>
          {uncertain ? 'Check live resolution' : 'Refresh report status'}
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        Private report investigation
      </h2>
      {!current && <p role="status">Checking the current report and resolution…</p>}
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
      {report && (
        <>
          <article className="moderation-review">
            <p className="eyebrow">
              {report.targetKind} / {report.state}
            </p>
            <h3>{reportCategoryLabels[report.category]}</h3>
            {(report.targetKind === 'agent' || report.context?.snapshot.kind === 'review') && (
              <Link
                prefetch={false}
                className="action-secondary"
                href={
                  '/workspace/moderation/agent/?resourceId=' +
                  (report.targetKind === 'agent'
                    ? report.targetId
                    : report.context?.snapshot.kind === 'review'
                      ? report.context.snapshot.resourceId
                      : '')
                }
              >
                Review agent access ↗
              </Link>
            )}
            <h4>The concern</h4>
            <p className="moderation-prose">{report.explanation}</p>
            <p>
              Received{' '}
              <time dateTime={report.createdAt}>
                {new Date(report.createdAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
              </time>
            </p>
            <details>
              <summary>Target reference</summary>
              <p className="moderation-prose">
                {report.targetKind}: {report.targetId}
              </p>
            </details>
            {report.resolvedAt && (
              <aside className="moderation-existing">
                <h4>Recorded resolution</h4>
                <p className="moderation-prose">{report.resolution}</p>
                <p>
                  Recorded{' '}
                  <time dateTime={report.resolvedAt}>
                    {new Date(report.resolvedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
                  </time>
                </p>
              </aside>
            )}
          </article>
          <ReportContext context={report.context} />
          <ReportResolutionForm
            report={report}
            explanation={notes?.explanation ?? ''}
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
