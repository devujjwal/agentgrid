'use client';
import { useState, type FormEvent, type RefObject } from 'react';
import type { OwnedVersion, OwnedVersions } from '../../domain/versions';
import type { IdentityResponse } from '../../domain/session';
import { VersionSnapshot } from './VersionSnapshot';

function PendingWithdrawal({
  version,
  busy,
  withdraw,
}: {
  version: OwnedVersion;
  busy: boolean;
  withdraw: (id: string, reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (
      window.confirm(
        'Withdraw this pending review request? Its immutable version will remain in your private history.',
      )
    )
      withdraw(version.id, reason);
  }
  return (
    <details className="version-withdrawal">
      <summary>Withdraw review request</summary>
      <form onSubmit={submit}>
        <label htmlFor={'withdraw-' + version.id}>
          Reason for withdrawing version {version.version}
        </label>
        <textarea
          id={'withdraw-' + version.id}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          minLength={20}
          maxLength={2400}
          rows={3}
          disabled={busy}
        />
        <button className="action-secondary" disabled={busy || reason.trim().length < 20}>
          Withdraw from review
        </button>
      </form>
    </details>
  );
}
export function VersionHistory({
  history,
  busy,
  withdraw,
  changeOffset,
  connection,
  resourceId,
  headingRef,
}: {
  history: OwnedVersions;
  busy: boolean;
  withdraw: (id: string, reason: string) => void;
  changeOffset: (offset: number) => void;
  connection: IdentityResponse;
  resourceId: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  return (
    <section aria-labelledby="version-history-title" className="version-history">
      <p className="eyebrow">Immutable / review history</p>
      <h2 id="version-history-title" ref={headingRef} tabIndex={-1}>
        Every version keeps its place.
      </h2>
      {history.versions.length === 0 ? (
        <p>No submitted versions yet. Saving a private draft does not submit it.</p>
      ) : (
        <ol className="version-timeline">
          {history.versions.map((version) => (
            <li key={version.id}>
              <header>
                <h3>Version {version.version}</h3>
                <span className="version-state">
                  {version.state === 'pending' ? 'Awaiting review' : version.state}
                </span>
              </header>
              <p>
                Submitted{' '}
                <time dateTime={version.submittedAt}>
                  {new Date(version.submittedAt).toLocaleDateString('en', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </p>
              {version.reviewedAt && (
                <p>
                  Decision recorded{' '}
                  <time dateTime={version.reviewedAt}>
                    {new Date(version.reviewedAt).toLocaleDateString('en', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </time>
                </p>
              )}
              {version.reason && <p className="version-reason">{version.reason}</p>}
              <details>
                <summary>Frozen content identifier</summary>
                <code>{version.contentDigest}</code>
              </details>
              <VersionSnapshot
                connection={connection}
                resourceId={resourceId}
                versionId={version.id}
              />
              {version.state === 'pending' && (
                <PendingWithdrawal version={version} busy={busy} withdraw={withdraw} />
              )}
            </li>
          ))}
        </ol>
      )}
      {(history.offset > 0 || history.hasMore) && (
        <nav aria-label="Version history pages">
          <button
            className="action-secondary"
            disabled={busy || history.offset === 0}
            onClick={() => changeOffset(Math.max(0, history.offset - 20))}
          >
            Previous
          </button>
          <button
            className="action-secondary"
            disabled={busy || !history.hasMore || history.offset + 20 > 9999}
            onClick={() => changeOffset(history.offset + 20)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}
