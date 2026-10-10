'use client';
import { useState } from 'react';
import type { MediaOverview, ConnectionSummary } from '../../domain/media-workspace';
export const platformNames = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn' };
export function ConnectionControls({
  overview,
  busy,
  onConnect,
  onChange,
}: {
  overview: MediaOverview;
  busy: boolean;
  onConnect: (platform: ConnectionSummary['platform']) => Promise<void>;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  return (
    <section aria-labelledby="connections-title">
      <h2 id="connections-title">Your connections</h2>
      <p>
        Connecting an account does not allow posting. Enable a destination below, then approve each
        video and post separately.
      </p>
      {!overview.capabilities.connect && (
        <p className="media-notice" role="status">
          Connections are being prepared. Account sign-in and posting are disabled.
        </p>
      )}
      <div className="reel-actions">
        {(['instagram', 'facebook', 'linkedin'] as const).map((platform) => (
          <button
            type="button"
            className="action-secondary"
            key={platform}
            disabled={busy || !overview.capabilities.connect}
            onClick={() => void onConnect(platform)}
          >
            Connect {platformNames[platform]}
          </button>
        ))}
      </div>
      <p className="media-help">
        Instagram requires a professional account linked to a Facebook Page. Facebook posting
        supports Pages. LinkedIn uses a member account with the required publishing permissions.
      </p>
      {!overview.connections.length ? (
        <p>No accounts connected yet.</p>
      ) : (
        <ul className="media-list">
          {overview.connections.map((connection) => (
            <ConnectionRow
              key={connection.id}
              connection={connection}
              now={Date.parse(overview.observedAt)}
              busy={busy}
              enabled={overview.capabilities.publish}
              onChange={onChange}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
function ConnectionRow({
  connection,
  now,
  busy,
  enabled,
  onChange,
}: {
  connection: ConnectionSummary;
  now: number;
  busy: boolean;
  enabled: boolean;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const expired = Date.parse(connection.expiresAt) <= now;
  return (
    <li className="run-card">
      <h3>{connection.label}</h3>
      <p>
        {platformNames[connection.platform]} ·{' '}
        {expired
          ? 'Expired — reconnect'
          : connection.publishingEnabled
            ? 'Enabled for approved posts'
            : 'Posting disabled'}
      </p>
      <p>Permission expires {new Date(connection.expiresAt).toLocaleString()}.</p>
      {!connection.publishingEnabled && !expired && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onChange('enable-connection', {
              id: connection.id,
              platform: connection.platform,
              label: connection.label,
              expiresAt: connection.expiresAt,
              confirmed: true,
            }).then(() => setConfirmed(false));
          }}
        >
          <label className="media-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy || !enabled}
            />
            Allow AgentGrid to post to this account after I approve each post.
          </label>
          <button className="action-primary" disabled={busy || !enabled || !confirmed}>
            Enable this destination
          </button>
        </form>
      )}
      <div className="reel-actions">
        {connection.publishingEnabled && (
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void onChange('disable-connection', { id: connection.id })}
          >
            Disable posting
          </button>
        )}
        <button
          type="button"
          className="action-secondary"
          disabled={busy}
          onClick={() => void onChange('disconnect', { id: connection.id })}
        >
          Disconnect account
        </button>
      </div>
      <p className="media-help">
        Disconnecting cancels queued posts and removes the saved connection token. A request already
        sent may still complete.
      </p>
    </li>
  );
}
