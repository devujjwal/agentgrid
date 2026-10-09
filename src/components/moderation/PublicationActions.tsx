'use client';
import { useEffect, useRef, useState } from 'react';
import type { ReleaseApproval } from '../../domain/release-approval';
import {
  PublicationResultSchema,
  type PublicationOperation,
  type PublicationResult,
} from '../../domain/publication-operation';
import { communityRequest } from '../../services/community';
import { ConfirmAction } from '../feedback/ConfirmAction';

export function PublicationActions({
  approval,
  csrf,
  disabled,
}: {
  approval: ReleaseApproval;
  csrf: string;
  disabled: boolean;
}) {
  const [result, setResult] = useState<PublicationResult | null>(null);
  const [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const notice = useRef<HTMLParagraphElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (result || error) notice.current?.focus();
  }, [result, error]);
  async function run(action: PublicationOperation['action']) {
    if (busy || disabled || (uncertain && action !== 'inspect')) return;
    const plan: PublicationOperation =
      action === 'publish' && result && 'reviewFingerprint' in result
        ? { action, requestId: approval.requestId, fingerprint: result.reviewFingerprint }
        : { action: action === 'publish' ? 'inspect' : action, requestId: approval.requestId };
    setBusy(true);
    setError(null);
    // Clear preparation before sending a write; it may never be blindly retried.
    if (action === 'publish') {
      setResult(null);
      setUncertain(true);
    }
    try {
      const receipt = await communityRequest('/api/admin/publication/', PublicationResultSchema, {
        csrf,
        body: plan,
      });
      if (
        receipt.state === 'not-found' ||
        receipt.requestId !== approval.requestId ||
        receipt.versionId !== approval.versionId ||
        receipt.resourceId !== approval.resourceId
      )
        throw new Error('Unexpected publication receipt.');
      if (!mounted.current) return;
      setResult(receipt);
      setUncertain(false);
    } catch {
      if (mounted.current) {
        setResult(null);
        setError(
          action === 'publish'
            ? 'Publication was not confirmed. Check the recorded outcome before continuing; do not submit another publication request.'
            : 'Publication checks are unavailable. Verify administrator access, server activation and the recorded evidence. No publication was confirmed.',
        );
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const prepared = result && 'slug' in result && result.state === 'requested' ? result : null;
  const closed = approval.state !== 'requested' || (result && result.state !== 'requested');
  return (
    <div className="moderation-context" aria-busy={busy}>
      <p>
        <strong>Administrator publication</strong>
      </p>
      <p>
        Check this exact version and its recorded evidence before releasing it. Website deployment
        is a separate step.
      </p>
      <div className="moderation-toolbar">
        <button
          className="action-secondary"
          disabled={disabled || busy}
          onClick={() => void run('inspect')}
        >
          Check recorded outcome
        </button>
        {!closed && (
          <button
            className="action-secondary"
            disabled={disabled || busy || uncertain}
            onClick={() => void run('prepare')}
          >
            Prepare this release
          </button>
        )}
      </div>
      {busy && <p role="status">Checking the publication service…</p>}
      {error && (
        <p role="alert" ref={notice} tabIndex={-1}>
          {error}
        </p>
      )}
      {result && (
        <p role="status" ref={notice} tabIndex={-1}>
          {result.state === 'released'
            ? 'Release recorded. '
            : result.state === 'cancelled'
              ? 'Request cancelled. '
              : 'Awaiting publication. '}
          {result.meaning}
        </p>
      )}
      {prepared && (
        <>
          <p>
            <strong>{prepared.slug}</strong> · version {prepared.packageVersion}
          </p>
          <p>
            Review fingerprint{' '}
            <code className="moderation-prose">{prepared.reviewFingerprint}</code>
          </p>
          <ConfirmAction
            label="Publish reviewed version"
            title="Release this reviewed version?"
            description="The server will recheck the selected evidence, current staff authority and unchanged agent state. This makes the database release available to public community services; it does not deploy the static page."
            confirmation="Publish this version"
            disabled={disabled || busy || uncertain}
            confirm={() => void run('publish')}
          />
        </>
      )}
    </div>
  );
}
