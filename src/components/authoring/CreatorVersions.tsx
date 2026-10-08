'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef } from 'react';
import { z } from 'zod';
import { parseAgentSpecification } from '../../domain/agent-specification';
import { isLaterVersion } from '../../domain/versions';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorMemory } from './CreatorMemory';
import { useCreatorVersions } from './useCreatorVersions';
import { VersionHistory } from './VersionHistory';

export function CreatorVersions() {
  const identity = useIdentity(),
    params = useSearchParams(),
    memory = useCreatorMemory();
  const id = params.get('resourceId');
  const valid =
    id !== null &&
    z.uuid().safeParse(id).success &&
    params.getAll('resourceId').length === 1 &&
    [...params.keys()].every((key) => key === 'resourceId');
  const versions = useCreatorVersions(identity.identity, valid ? id : null);
  const draft = versions.draft,
    history = versions.history;
  const historyHeading = useRef<HTMLHeadingElement>(null);
  const requestedPage = useRef<{ resourceId: string; offset: number } | null>(null);
  useEffect(() => {
    if (
      history &&
      requestedPage.current?.resourceId === id &&
      requestedPage.current.offset === history.offset
    ) {
      historyHeading.current?.focus();
      requestedPage.current = null;
    }
  }, [history, id]);
  const complete = useMemo(() => {
    if (!draft) return false;
    try {
      parseAgentSpecification(draft.specification);
      return (
        draft.specification.license.identifier !== 'unselected' &&
        draft.specification.license.permissions.use
      );
    } catch {
      return false;
    }
  }, [draft]);
  const dirty = Boolean(
    identity.identity?.signedIn &&
    memory.buffer?.email === identity.identity.email &&
    memory.buffer.record.resourceId === id &&
    memory.buffer.dirty,
  );
  const editHref = '/workspace/agent/?resourceId=' + id;
  if (!valid)
    return <p role="alert">This history address is invalid. Open the agent from your workspace.</p>;
  if (identity.pending || versions.pending)
    return <p role="status">Verifying your version history…</p>;
  if (identity.error || versions.error)
    return (
      <section className="identity-panel">
        <h2>History could not be opened.</h2>
        <p role="alert">{identity.error ?? versions.error}</p>
        <button
          className="action-secondary"
          onClick={() => (identity.error ? identity.reload() : versions.refresh())}
        >
          Reconnect
        </button>
        <Link prefetch={false} href="/workspace/" className="action-secondary">
          Open your workspace
        </Link>
      </section>
    );
  if (!identity.identity?.signedIn)
    return (
      <section className="identity-panel">
        <h2>Your versions stay yours.</h2>
        <p>Sign in to view your private review history.</p>
        <Link
          prefetch={false}
          className="action-primary"
          target={memory.hasUnsaved ? '_blank' : undefined}
          rel={memory.hasUnsaved ? 'noopener noreferrer' : undefined}
          href={'/sign-in/?returnTo=' + encodeURIComponent('/workspace/versions/?resourceId=' + id)}
        >
          {memory.hasUnsaved ? 'Sign in in another tab' : 'Connect to AgentGrid'}
        </Link>
      </section>
    );
  if (!draft || !history) return <p role="alert">Your version history is unavailable.</p>;
  const pending = history.pendingVersionId !== null;
  const advances =
    history.latestVersion === null ||
    isLaterVersion(draft.specification.version, history.latestVersion);
  return (
    <>
      <section
        className="version-submission"
        aria-labelledby="submit-version-title"
        aria-busy={versions.busy}
      >
        <p className="eyebrow">
          {draft.specification.identity.name} / private draft revision {draft.revision}
        </p>
        <h2 id="submit-version-title">Your next version.</h2>
        <p>
          Saved package version: <strong>{draft.specification.version}</strong>. The saved
          definition and guide will be submitted together for review.
        </p>
        <Link prefetch={false} href={editHref} className="action-secondary">
          Return to draft <span aria-hidden="true">↗</span>
        </Link>
        {!history.submissionEnabled ? (
          <p>Submissions are not open for this resource. Your private draft remains available.</p>
        ) : dirty ? (
          <p>
            Unsaved edits are held in this tab. Return to your draft and save them before
            submitting.
          </p>
        ) : pending ? (
          <p>
            A version is already awaiting review. Resolve or withdraw that request before submitting
            another.
          </p>
        ) : !advances ? (
          <p>
            Advance the package version in your draft beyond {history.latestVersion} before
            submitting. Frozen version numbers cannot be reused.
          </p>
        ) : !complete ? (
          <p>
            The saved definition is unfinished or has no explicit use terms. Check definition
            readiness in the editor before submitting.
          </p>
        ) : (
          <button
            type="button"
            className="action-primary"
            disabled={versions.busy}
            onClick={() => {
              if (
                window.confirm(
                  'Freeze the saved version ' +
                    draft.specification.version +
                    ' and submit it for review? Its content and version number cannot be overwritten, even if you later withdraw the request.',
                )
              )
                void versions.submit();
            }}
          >
            {versions.busy ? 'Submitting…' : 'Freeze and submit ' + draft.specification.version}
          </button>
        )}
      </section>
      {versions.feedback && (
        <p className="version-feedback" role={versions.feedback.failed ? 'alert' : 'status'}>
          {versions.feedback.message}
        </p>
      )}
      <VersionHistory
        headingRef={historyHeading}
        connection={identity.identity}
        resourceId={id!}
        history={history}
        busy={versions.busy}
        withdraw={(versionId, reason) => void versions.withdraw(versionId, reason)}
        changeOffset={(offset) => {
          requestedPage.current = { resourceId: id!, offset };
          versions.changeOffset(offset);
        }}
      />
    </>
  );
}
