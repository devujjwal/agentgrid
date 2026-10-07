'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { SavedListSchema, type SavedList as SavedListData } from '../../domain/saves';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import { communityRequest } from '../../services/community';
import { useIdentity } from '../identity/useIdentity';
import { SavedList } from './SavedList';

function ConnectedSaves({ csrf }: { csrf: string }) {
  const [offset, setOffset] = useState(0),
    [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null),
    [mutationError, setMutationError] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<{
    offset: number;
    retry: number;
    identity: WorkspaceIdentity | null;
    list: SavedListData | null;
    error: string | null;
  }>({ offset: -1, retry: -1, identity: null, list: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest('/api/workspace/', WorkspaceIdentitySchema, undefined, controller.signal)
      .then(async (identity) => {
        const list =
          identity.profile?.status === 'active'
            ? await communityRequest(
                '/api/workspace/saved/?offset=' + offset,
                SavedListSchema,
                undefined,
                controller.signal,
              )
            : null;
        if (controller.signal.aborted) return;
        if (list && !list.agents.length && offset > 0) {
          setOffset(Math.max(0, offset - 20));
          return;
        }
        setSnapshot({ offset, retry, identity, list, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            offset,
            retry,
            identity: null,
            list: null,
            error: error instanceof Error ? error.message : 'Your saved list could not be loaded.',
          });
      });
    return () => controller.abort();
  }, [offset, retry]);
  async function remove(id: string) {
    if (busy) return;
    setBusy(true);
    setMutationError(null);
    setNotice(null);
    try {
      const result = await communityRequest(
        '/api/workspace/favorite/',
        z.strictObject({ saved: z.boolean() }),
        { csrf, body: { resourceId: id, saved: false } },
      );
      if (result.saved)
        throw new Error('The saved state could not be confirmed. Refresh before trying again.');
      setNotice('Removed from your saved agents.');
      setRetry((value) => value + 1);
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'This agent could not be removed.');
    } finally {
      setBusy(false);
    }
  }
  const pending = snapshot.offset !== offset || snapshot.retry !== retry;
  return (
    <div className="saved-content" aria-busy={pending || busy}>
      {pending && <p role="status">Loading your saved connections…</p>}
      {notice && <p role="status">{notice}</p>}
      {mutationError && <p role="alert">{mutationError}</p>}
      {!pending && snapshot.error && (
        <section className="saved-empty">
          <h2>Connection interrupted.</h2>
          <p role="alert">{snapshot.error}</p>
          <button className="action-secondary" onClick={() => setRetry((value) => value + 1)}>
            Reconnect
          </button>
        </section>
      )}
      {!pending && snapshot.identity && !snapshot.list && (
        <section className="saved-empty">
          <h2>
            {snapshot.identity.profile
              ? 'Account access is restricted.'
              : 'Connect a profile to save agents.'}
          </h2>
          <p>
            {snapshot.identity.profile
              ? 'Your account cannot use saved agents right now.'
              : 'Your sign-in is verified. Joining the community is a separate choice; check its current registration status in your workspace.'}
          </p>
          <Link prefetch={false} href="/workspace/" className="action-secondary">
            Open your workspace
          </Link>
        </section>
      )}
      {!pending && snapshot.list && (
        <SavedList
          list={snapshot.list}
          busy={busy || pending}
          remove={(id) => void remove(id)}
          offset={offset}
          changeOffset={setOffset}
        />
      )}
    </div>
  );
}

export function SavedAgents() {
  const { identity, pending, error, reload } = useIdentity();
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Your network / saved agents</p>
          <h1>
            Keep the useful
            <br />
            <em>within reach.</em>
          </h1>
          <p>Your private list, connected across devices.</p>
        </div>
        <Link prefetch={false} href="/workspace/" className="action-secondary">
          Your workspace <span aria-hidden="true">↗</span>
        </Link>
      </header>
      {pending && <p role="status">Verifying your connection…</p>}
      {error && (
        <section className="saved-empty">
          <h2>Connection interrupted.</h2>
          <p role="alert">{error}</p>
          <button className="action-secondary" onClick={() => void reload()}>
            Reconnect
          </button>
        </section>
      )}
      {identity && !identity.signedIn && (
        <section className="saved-empty">
          <h2>Bring your orbit with you.</h2>
          <p>
            Sign in to see the agents you saved. Exploring the network is always available without
            an account.
          </p>
          <Link prefetch={false} href="/sign-in/?returnTo=%2Fsaves%2F" className="action-primary">
            Connect to AgentGrid <span aria-hidden="true">↗</span>
          </Link>
        </section>
      )}
      {identity?.signedIn && <ConnectedSaves csrf={identity.csrf} />}
    </>
  );
}
