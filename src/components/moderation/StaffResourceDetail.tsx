'use client';
import { useEffect, useRef, useState } from 'react';
import {
  StaffResourceSchema,
  type StaffResource,
  type ResourceDecision,
} from '../../domain/resource-moderation';
import { CommunityError, communityRequest } from '../../services/community';
import { ResourceDecisionForm } from './ResourceDecisionForm';

export function StaffResourceDetail({
  resourceId,
  csrf,
  notes,
  changeNotes,
  recheck,
}: {
  resourceId: string;
  csrf: string;
  notes: { explanation: string } | null;
  changeNotes: (value: { explanation: string } | null) => void;
  recheck: () => void;
}) {
  const [retry, setRetry] = useState(0),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [receipt, setReceipt] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    resource: StaffResource | null;
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
      '/api/moderation/resource/?resourceId=' + resourceId,
      StaffResourceSchema,
      undefined,
      controller.signal,
    ).then(
      (resource) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, resource, error: null });
          setUncertain(false);
        }
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            resource: null,
            error: failure instanceof Error ? failure.message : 'Agent status unavailable.',
          });
      },
    );
    return () => controller.abort();
  }, [resourceId, retry]);
  const current = snapshot?.retry === retry ? snapshot : null,
    resource = current?.resource;
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
  async function decide(input: ResourceDecision) {
    if (busy || uncertain || !resource) return;
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      const saved = await communityRequest(
        '/api/moderation/resource-decision/',
        StaffResourceSchema,
        {
          csrf,
          body: input,
        },
      );
      if (!mounted.current) return;
      changeNotes(null);
      setSnapshot({ retry, resource: saved, error: null });
      setReceipt(
        `Live access is ${saved.status}. Decision revision ${saved.revision} is recorded.`,
      );
      focus.current = true;
    } catch (failure) {
      if (!mounted.current) return;
      setUncertain(true);
      setError(
        failure instanceof CommunityError && failure.code === 'conflict'
          ? 'This agent changed while you were reviewing it. Check live status before making another decision.'
          : failure instanceof CommunityError &&
              ['invalid-request', 'request-refused', 'not-signed-in', 'rate-limited'].includes(
                failure.code,
              )
            ? failure.message + ' Check live status before continuing.'
            : 'The decision may have been recorded, but confirmation did not arrive. Check live status before attempting another action. Your response is retained.',
      );
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  return (
    <div className="moderation-detail" aria-busy={busy || !current}>
      <div className="moderation-toolbar">
        <p>
          Agent access <span className="moderation-live">Live data</span>
        </p>
        <button className="action-secondary" disabled={busy || !current} onClick={reload}>
          {uncertain ? 'Check live status' : 'Refresh agent status'}
        </button>
      </div>
      <h2 ref={heading} tabIndex={-1}>
        Review this agent’s access.
      </h2>
      {!current && <p role="status">Checking the agent’s current status and release…</p>}
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
      {resource && (
        <>
          <article className="moderation-review">
            <p className="eyebrow">Agent / {resource.status}</p>
            <h3>{resource.slug}</h3>
            <dl className="moderation-facts">
              <div>
                <dt>Live access</dt>
                <dd>{resource.status}</dd>
              </div>
              <div>
                <dt>Status revision</dt>
                <dd>{resource.revision}</dd>
              </div>
              <div>
                <dt>Released version</dt>
                <dd>{resource.releasedVersion ?? 'No release'}</dd>
              </div>
              <div>
                <dt>Owner account</dt>
                <dd>{resource.ownerStatus}</dd>
              </div>
            </dl>
            {resource.moderatedAt && (
              <aside className="moderation-existing">
                <h4>Last staff decision</h4>
                <p className="moderation-prose">{resource.reason}</p>
                <time dateTime={resource.moderatedAt}>
                  {new Date(resource.moderatedAt).toISOString().replace('T', ' ').slice(0, 16)} UTC
                </time>
              </aside>
            )}
          </article>
          <ResourceDecisionForm
            resource={resource}
            explanation={notes?.explanation ?? ''}
            changeNotes={(explanation) => changeNotes({ explanation })}
            busy={busy}
            uncertain={uncertain}
            submit={(value) => void decide(value)}
          />
        </>
      )}
    </div>
  );
}
