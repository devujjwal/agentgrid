'use client';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { communityRequest } from '../../services/community';
import {
  MediaOverviewSchema,
  PublicationSummarySchema,
  ReelSummarySchema,
  type MediaOverview,
} from '../../domain/media-workspace';
import { MediaDashboard } from './MediaDashboard';
export function ConnectedMediaWorkspace({ csrf }: { csrf: string }) {
  const [overview, setOverview] = useState<MediaOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest('/api/media/', MediaOverviewSchema, undefined, controller.signal).then(
      (value) => {
        if (!controller.signal.aborted) {
          setOverview(value);
          setError(null);
        }
      },
      (failure) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure.message : 'Unable to load your media workspace.',
          );
      },
    );
    return () => controller.abort();
  }, [revision]);
  async function request<T>(path: string, schema: z.ZodType<T>, body: unknown): Promise<T | null> {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await communityRequest(path, schema, { csrf, body });
      setRevision((v) => v + 1);
      setNotice('Workspace updated. Refresh to check the latest provider status.');
      return result;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update the workspace.');
      return null;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {overview ? (
        <MediaDashboard
          overview={overview}
          busy={busy}
          onChange={async (action, body) => {
            await request(`/api/media/${action}/`, z.null(), body);
          }}
          onPrepareReel={async (draft, sourceRunId) => {
            await request('/api/media/prepare-reel/', ReelSummarySchema, {
              idempotencyKey: crypto.randomUUID(),
              plan: { ...draft, sourceRunId },
            });
          }}
          onPreparePublication={(body) =>
            request('/api/media/prepare-publication/', PublicationSummarySchema, body)
          }
          onConnect={async (platform) => {
            const result = await request(
              `/api/social/${platform}/start/`,
              z.strictObject({ authorizationUrl: z.url() }),
              {},
            );
            if (!result) return;
            const url = new URL(result.authorizationUrl);
            const valid =
              platform === 'linkedin'
                ? url.origin === 'https://www.linkedin.com' &&
                  url.pathname === '/oauth/v2/authorization'
                : url.origin === 'https://www.facebook.com' &&
                  /^\/v\d+\.0\/dialog\/oauth$/.test(url.pathname);
            if (!valid || url.username || url.password) {
              setError('Account sign-in could not be verified.');
              return;
            }
            window.location.assign(url.href);
          }}
        />
      ) : (
        !error && <p role="status">Loading your media workspace…</p>
      )}
      <button
        type="button"
        className="action-secondary"
        disabled={busy}
        onClick={() => setRevision((v) => v + 1)}
      >
        Refresh workspace
      </button>
    </>
  );
}
