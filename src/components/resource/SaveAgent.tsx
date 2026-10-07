'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { IdentityResponseSchema } from '../../domain/session';
import { WorkspaceIdentitySchema } from '../../domain/workspace';
import { SaveStateSchema } from '../../domain/saves';
import { communityRequest } from '../../services/community';

/** No session request on public page views. The visitor initiates all live work. */
export function SaveAgent({ resourceId, slug }: { resourceId: string; slug: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    const clear = () => {
      active.current?.abort();
      active.current = null;
      setSaved(false);
      setBusy(false);
      setNotice(null);
      setError(null);
    };
    const hidden = () => {
      if (document.hidden) clear();
    };
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      active.current?.abort();
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  async function toggle() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    setNotice(null);
    const signal = controller.signal;
    try {
      const identity = await communityRequest(
        '/api/identity/',
        IdentityResponseSchema,
        undefined,
        signal,
      );
      if (signal.aborted) return;
      if (!identity.signedIn) {
        router.push('/sign-in/?returnTo=' + encodeURIComponent('/agents/' + slug + '/'));
        return;
      }
      const workspace = await communityRequest(
        '/api/workspace/',
        WorkspaceIdentitySchema,
        undefined,
        signal,
      );
      if (signal.aborted) return;
      if (!workspace.profile) {
        setNotice('Join the community in your workspace to save agents.');
        return;
      }
      if (workspace.profile.status !== 'active')
        throw new Error('Your account cannot save agents right now.');
      const current = await communityRequest(
        '/api/workspace/favorite/?resourceId=' + resourceId,
        SaveStateSchema,
        undefined,
        signal,
      );
      if (!current.available && !saved)
        throw new Error('This agent is no longer available to save.');
      const desired = !saved;
      const result = await communityRequest(
        '/api/workspace/favorite/',
        z.strictObject({ saved: z.boolean() }),
        {
          csrf: identity.csrf,
          body: { resourceId, saved: desired },
        },
        signal,
      );
      if (signal.aborted) return;
      if (result.saved !== desired)
        throw new Error('The saved state could not be confirmed. Try again.');
      setSaved(result.saved);
      setNotice(
        result.saved ? 'Connected to your saved agents.' : 'Removed from your saved agents.',
      );
    } catch (error) {
      if (!signal.aborted)
        setError(error instanceof Error ? error.message : 'Your saved state could not be updated.');
    } finally {
      if (!signal.aborted) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return (
    <div className="resource-save">
      <button
        type="button"
        className="save-agent"
        aria-pressed={saved}
        disabled={busy}
        onClick={() => void toggle()}
      >
        <span className="save-signal" aria-hidden="true">
          {saved ? '◉' : '○'}
        </span>
        {busy ? 'Connecting…' : saved ? 'Saved · remove' : 'Save agent'}
      </button>
      {notice && (
        <p role="status">
          {notice} <a href="/saves/">Your saved agents</a> · <a href="/workspace/">Workspace</a>
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
