'use client';
import { useState } from 'react';
import type { MediaOverview, PublicationSummary } from '../../domain/media-workspace';
import { platformNames } from './ConnectionControls';
import { PublicationReview } from './PublicationReview';
export function PublicationComposer({
  overview,
  busy,
  onPrepare,
  onChange,
}: {
  overview: MediaOverview;
  busy: boolean;
  onPrepare: (body: unknown) => Promise<PublicationSummary | null>;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  const [runId, setRunId] = useState('');
  const [scheduled, setScheduled] = useState('');
  const [prepared, setPrepared] = useState<PublicationSummary | null>(null);
  const [destinations, setDestinations] = useState<
    Record<string, { connectionId: string; caption: string }>
  >({});
  const reels = overview.reels.filter(
    (r) => r.state === 'ready' && r.asset && r.asset.seconds >= 3,
  );
  const ready = overview.connections.filter(
    (c) => c.publishingEnabled && Date.parse(c.expiresAt) > Date.parse(overview.observedAt),
  );
  const availableDestinations = Object.fromEntries(
    Object.entries(destinations).filter(([platform, d]) =>
      ready.some((c) => c.id === d.connectionId && c.platform === platform),
    ),
  );
  const clear = () => setPrepared(null);
  return (
    <section aria-labelledby="post-title">
      <h2 id="post-title">Prepare a publication</h2>
      <p>
        Select a finished video and enabled accounts. Each destination has its own caption. Nothing
        is posted until you approve the resulting preview.
      </p>
      {!overview.capabilities.publish && (
        <p className="media-notice">
          Publishing is disabled. Preview and approval controls will open after activation.
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const reel = reels.find((r) => r.id === runId);
          if (!reel?.asset) return;
          void onPrepare({
            runId: reel.id,
            revision: 1,
            mediaId: reel.asset.id,
            mediaSha256: reel.asset.sha256,
            destinations: Object.entries(availableDestinations)
              .filter(([, d]) => d.connectionId)
              .map(([platform, d]) => ({ platform, ...d })),
            scheduledAt: scheduled ? new Date(scheduled).toISOString() : new Date().toISOString(),
          }).then(setPrepared);
        }}
      >
        <label htmlFor="post-reel">Finished video</label>
        <select
          id="post-reel"
          required
          value={runId}
          disabled={busy || !overview.capabilities.publish}
          onChange={(e) => {
            setRunId(e.target.value);
            clear();
          }}
        >
          <option value="">Choose a video</option>
          {reels.map((r) => (
            <option key={r.id} value={r.id}>
              {r.plan.title}
            </option>
          ))}
        </select>
        {!reels.length && <p>No finished videos available yet.</p>}
        {(['instagram', 'facebook', 'linkedin'] as const).map((platform) => (
          <fieldset key={platform} className="reel-scene">
            <legend>{platformNames[platform]}</legend>
            <label htmlFor={`post-account-${platform}`}>Destination account</label>
            <select
              id={`post-account-${platform}`}
              disabled={busy || !overview.capabilities.publish}
              value={availableDestinations[platform]?.connectionId ?? ''}
              onChange={(e) => {
                setDestinations({
                  ...destinations,
                  [platform]: {
                    connectionId: e.target.value,
                    caption: destinations[platform]?.caption ?? '',
                  },
                });
                clear();
              }}
            >
              <option value="">Do not post here</option>
              {ready
                .filter((c) => c.platform === platform)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
            </select>
            {availableDestinations[platform]?.connectionId && (
              <>
                <label htmlFor={`post-caption-${platform}`}>Caption</label>
                <textarea
                  id={`post-caption-${platform}`}
                  required
                  rows={3}
                  maxLength={platform === 'instagram' ? 2200 : 3000}
                  value={availableDestinations[platform]!.caption}
                  disabled={busy}
                  onChange={(e) => {
                    setDestinations({
                      ...destinations,
                      [platform]: { ...destinations[platform]!, caption: e.target.value },
                    });
                    clear();
                  }}
                />
              </>
            )}
          </fieldset>
        ))}
        <label htmlFor="post-time">
          Schedule ({Intl.DateTimeFormat().resolvedOptions().timeZone})
        </label>
        <input
          id="post-time"
          type="datetime-local"
          value={scheduled}
          disabled={busy || !overview.capabilities.schedule}
          onChange={(e) => {
            setScheduled(e.target.value);
            clear();
          }}
        />
        <p>
          Leave blank to publish after approval. Scheduled posts must fall within the next 24 hours.{' '}
          {!overview.capabilities.schedule && 'Scheduling is currently disabled.'}
        </p>
        <button
          className="action-primary"
          disabled={
            busy ||
            !overview.capabilities.publish ||
            !runId ||
            !Object.values(availableDestinations).some((d) => d.connectionId)
          }
        >
          Prepare exact preview
        </button>
      </form>
      {prepared && (
        <PublicationReview
          key={prepared.digest}
          publication={prepared}
          overview={overview}
          busy={busy}
          onChange={async (action, body) => {
            await onChange(action, body);
            if (action === 'approve-publication' || action === 'cancel-publication')
              setPrepared(null);
          }}
        />
      )}
    </section>
  );
}
