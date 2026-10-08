'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import {
  StaffSubmissionSchema,
  type StaffSubmission,
  type RejectSubmission,
} from '../../domain/submission-moderation';
import { CommunityError, communityRequest } from '../../services/community';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { SubmissionDocument } from './SubmissionDocument';
import { SubmissionRejectionForm } from './SubmissionRejectionForm';

const ReleaseApprovalPanel = dynamic(() => import('./ReleaseApprovalPanel'), {
  loading: () => <p role="status">Loading publication review…</p>,
});
const HostEvidencePanel = dynamic(() => import('./HostEvidencePanel'), {
  loading: () => <p role="status">Loading evidence tools…</p>,
});

export function StaffSubmissionDetail({
  versionId,
  email,
  csrf,
  notes,
  changeNotes,
  back,
  recheck,
}: {
  versionId: string;
  email: string;
  csrf: string;
  notes: { explanation: string } | null;
  changeNotes: (value: { explanation: string } | null) => void;
  back: () => void;
  recheck: () => void;
}) {
  const [showRelease, setShowRelease] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [receipt, setReceipt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    submission: StaffSubmission | null;
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
      '/api/moderation/submission/?versionId=' + versionId,
      StaffSubmissionSchema,
      undefined,
      controller.signal,
    ).then(
      (submission) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, submission, error: null });
          setUncertain(false);
        }
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            submission: null,
            error: failure instanceof Error ? failure.message : 'Submission unavailable.',
          });
      },
    );
    return () => controller.abort();
  }, [versionId, retry]);
  const current = snapshot?.retry === retry ? snapshot : null,
    submission = current?.submission;
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
  async function decide(input: RejectSubmission) {
    if (busy || uncertain || !submission) return;
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      const saved = await communityRequest('/api/moderation/rejection/', StaffSubmissionSchema, {
        csrf,
        body: input,
      });
      if (!mounted.current) return;
      changeNotes(null);
      setSnapshot({ retry, submission: saved, error: null });
      setReceipt(
        `Version ${saved.version} rejected. Your feedback is recorded and available to the creator.`,
      );
      focus.current = true;
    } catch (failure) {
      if (!mounted.current) return;
      setUncertain(true);
      setError(
        failure instanceof CommunityError && failure.code === 'conflict'
          ? 'This submission already changed. Check its live decision before continuing.'
          : failure instanceof CommunityError &&
              ['invalid-request', 'request-refused', 'not-signed-in', 'rate-limited'].includes(
                failure.code,
              )
            ? failure.message + ' Check live status before continuing.'
            : 'The rejection may have been recorded, but confirmation did not arrive. Check live status before attempting another action. Your response is retained.',
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
            label="Back to submission queue"
            title="Leave this response?"
            description="Your unsaved response will be discarded. Recorded submission outcomes stay unchanged."
            confirmation="Discard response and return"
            disabled={busy}
            confirm={back}
          />
        ) : (
          <button className="action-secondary" disabled={busy} onClick={back}>
            ← Submission queue
          </button>
        )}
        <button className="action-secondary" disabled={busy || !current} onClick={reload}>
          {uncertain ? 'Check live decision' : 'Refresh submission status'}
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        Immutable submission review
      </h2>
      {!current && <p role="status">Checking the current submission and decision…</p>}
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
      {submission && (
        <>
          <article className="moderation-review">
            <p className="eyebrow">
              Version {submission.version} / {submission.state}
            </p>
            <h3>{submission.name}</h3>
            <p className="moderation-prose">/{submission.slug}</p>
            <p>
              Submitted{' '}
              <time dateTime={submission.submittedAt}>
                {new Date(submission.submittedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
              </time>
            </p>
            {submission.reviewedAt && (
              <aside className="moderation-existing">
                <h4>Recorded decision</h4>
                <p className="moderation-prose">{submission.reason}</p>
                <p>
                  Recorded{' '}
                  <time dateTime={submission.reviewedAt}>
                    {new Date(submission.reviewedAt).toISOString().replace('T', ' ').slice(0, 16)}{' '}
                    UTC
                  </time>
                </p>
              </aside>
            )}
          </article>
          <Link
            prefetch={false}
            className="action-secondary"
            href={'/workspace/moderation/agent/?resourceId=' + submission.resourceId}
          >
            Review agent access ↗
          </Link>
          <SubmissionDocument submission={submission} />
          <button
            className="action-secondary"
            aria-expanded={showEvidence}
            onClick={() => setShowEvidence((value) => !value)}
          >
            {showEvidence ? 'Hide host evidence' : 'Review host evidence'}
          </button>
          {showEvidence && <HostEvidencePanel submission={submission} csrf={csrf} email={email} />}
          <button
            className="action-secondary"
            aria-expanded={showRelease}
            onClick={() => setShowRelease((value) => !value)}
          >
            {showRelease ? 'Hide publication review' : 'Review publication'}
          </button>
          {showRelease && (
            <ReleaseApprovalPanel submission={submission} csrf={csrf} email={email} />
          )}
          <SubmissionRejectionForm
            submission={submission}
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
