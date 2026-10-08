'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useIdentity } from '../identity/useIdentity';
import { ForkSourceSchema, type ForkSource } from '../../domain/forks';
import { WorkspaceIdentitySchema } from '../../domain/workspace';
import { communityRequest } from '../../services/community';
import { ForkForm } from './ForkForm';
function ConnectedFork({ sourceVersionId, csrf }: { sourceVersionId: string; csrf: string }) {
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    source: ForkSource | null;
    error: string | null;
    membership: boolean;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest('/api/workspace/', WorkspaceIdentitySchema, undefined, controller.signal)
      .then(async (workspace) => {
        if (workspace.profile?.status !== 'active') return { source: null, membership: false };
        const source = await communityRequest(
          '/api/workspace/forksource/?sourceVersionId=' + sourceVersionId,
          ForkSourceSchema,
          undefined,
          controller.signal,
        );
        return { source, membership: true };
      })
      .then(
        (value) => {
          if (!controller.signal.aborted) setSnapshot({ retry, ...value, error: null });
        },
        (failure) => {
          if (!controller.signal.aborted)
            setSnapshot({
              retry,
              source: null,
              membership: true,
              error:
                failure instanceof Error ? failure.message : 'The source could not be verified.',
            });
        },
      );
    return () => controller.abort();
  }, [retry, sourceVersionId]);
  const current = snapshot?.retry === retry ? snapshot : null;
  if (!current)
    return <p role="status">Checking your account and the source’s current reuse permission…</p>;
  if (!current.membership)
    return (
      <section className="identity-panel">
        <h2>A creator profile is required.</h2>
        <p>
          Check registration and your account’s current access in your workspace. Signing in alone
          does not create a community profile.
        </p>
        <Link prefetch={false} href="/workspace/">
          Open your workspace
        </Link>
      </section>
    );
  if (current.error || !current.source)
    return (
      <section className="identity-panel">
        <h2>This source could not be connected.</h2>
        <p role="alert">
          {current.error ?? 'The published source is no longer available for forking.'}
        </p>
        <button className="action-secondary" onClick={() => setRetry((value) => value + 1)}>
          Check source again
        </button>
        <p>
          <Link prefetch={false} href="/workspace/">
            Check existing agents in your workspace
          </Link>
        </p>
      </section>
    );
  return <ForkForm source={current.source} csrf={csrf} />;
}
export function ForkWorkspace() {
  const identity = useIdentity(),
    params = useSearchParams(),
    id = params.get('sourceVersionId');
  const valid =
    z.uuid().safeParse(id).success &&
    params.getAll('sourceVersionId').length === 1 &&
    [...params.keys()].every((key) => key === 'sourceVersionId');
  if (!valid)
    return (
      <p role="alert">
        This fork address is invalid. Open the published agent and choose Fork agent.
      </p>
    );
  if (identity.pending) return <p role="status">Verifying your connection…</p>;
  if (identity.error)
    return (
      <section className="identity-panel">
        <p role="alert">{identity.error}</p>
        <button className="action-secondary" onClick={identity.reload}>
          Reconnect
        </button>
      </section>
    );
  if (!identity.identity?.signedIn)
    return (
      <section className="identity-panel">
        <h2>Connect your branch to a creator.</h2>
        <p>
          Sign in to create a private fork. Its source remains attributed, and publication requires
          a separate review.
        </p>
        <Link
          prefetch={false}
          className="action-primary"
          href={
            '/sign-in/?returnTo=' + encodeURIComponent('/workspace/fork/?sourceVersionId=' + id)
          }
        >
          Sign in to fork
        </Link>
      </section>
    );
  return (
    <ConnectedFork
      key={identity.identity.email + id}
      sourceVersionId={id!}
      csrf={identity.identity.csrf}
    />
  );
}
