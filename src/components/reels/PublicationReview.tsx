'use client';
import { useState } from 'react';
import type { MediaOverview, PublicationSummary } from '../../domain/media-workspace';
import { platformNames } from './ConnectionControls';
export function PublicationReview({
  publication,
  overview,
  busy,
  onChange,
}: {
  publication: PublicationSummary;
  overview: MediaOverview;
  busy: boolean;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const pending = publication.deliveries.every((d) => d.state === 'pending');
  const expired =
    publication.expiresAt !== null &&
    Date.parse(publication.expiresAt) <= Date.parse(overview.observedAt);
  return (
    <article className="run-card">
      <h3>Publication preview</h3>
      <p>
        Scheduled: {new Date(publication.preview.scheduledAt).toLocaleString()} (
        {Intl.DateTimeFormat().resolvedOptions().timeZone})
      </p>
      <p>
        {publication.approvedAt
          ? expired
            ? 'Approval expired'
            : 'Approved'
          : pending
            ? 'Awaiting your approval'
            : 'Cancelled or completed'}{' '}
        · Video revision {publication.preview.revision}
      </p>
      <video
        className="reel-video"
        controls
        preload="none"
        src={`/api/media/video/?id=${publication.preview.runId}`}
        aria-label="Video in this publication preview"
      />
      {publication.preview.destinations.map((destination) => (
        <section key={destination.connectionId}>
          <h4>
            {platformNames[destination.platform]} ·{' '}
            {overview.connections.find((c) => c.id === destination.connectionId)?.label ??
              'Disconnected account'}
          </h4>
          <p className="reel-script">{destination.caption}</p>
          <p>
            Delivery:{' '}
            {publication.deliveries.find((d) => d.connectionId === destination.connectionId)
              ?.state ?? 'pending'}
          </p>
        </section>
      ))}
      {pending && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onChange('approve-publication', {
              id: publication.id,
              digest: publication.digest,
              confirmed: true,
            }).then(() => setConfirmed(false));
          }}
        >
          <label className="media-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy || !overview.capabilities.publish}
            />
            Approve this exact video, each destination and caption, and the schedule. I have
            permission to publish this content.
          </label>
          <button
            className="action-primary"
            disabled={busy || !confirmed || !overview.capabilities.publish}
          >
            {publication.approvedAt ? 'Confirm queued publication' : 'Approve publication'}
          </button>
        </form>
      )}
      <div className="reel-actions">
        {pending && (
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void onChange('cancel-publication', { id: publication.id })}
          >
            Cancel queued publication
          </button>
        )}
        {publication.deliveries
          .filter((d) => d.state === 'uncertain')
          .map((delivery) => (
            <div key={delivery.id}>
              {delivery.canResume && (
                <button
                  type="button"
                  className="action-secondary"
                  disabled={busy || !overview.capabilities.publish || expired}
                  onClick={() =>
                    void onChange('resume', {
                      id: delivery.id,
                      digest: publication.digest,
                      confirmed: true,
                    })
                  }
                >
                  Continue uploaded video
                </button>
              )}
              <button
                type="button"
                className="action-secondary"
                disabled={busy || !overview.capabilities.publish}
                onClick={() =>
                  void onChange('reconcile', {
                    id: delivery.id,
                    digest: publication.digest,
                    confirmed: true,
                  })
                }
              >
                Check uncertain delivery
              </button>
            </div>
          ))}
      </div>
      <p className="media-help">
        Editing creates a new preview. Cancel an older queued publication before replacing it.
        Cancellation cannot undo a post already sent.
      </p>
    </article>
  );
}
