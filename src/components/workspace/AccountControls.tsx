'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { WorkspaceIdentitySchema, type WorkspaceIdentity } from '../../domain/workspace';
import { communityRequest } from '../../services/community';
import { AccountRemovalForm } from './AccountRemovalForm';
function ConnectedAccount({ csrf, email }: { csrf: string; email: string }) {
  const [retry, setRetry] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    workspace: WorkspaceIdentity | null;
    error: string | null;
  }>({ retry: -1, workspace: null, error: null });
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      '/api/workspace/',
      WorkspaceIdentitySchema,
      undefined,
      controller.signal,
    ).then(
      (workspace) => {
        if (!controller.signal.aborted) setSnapshot({ retry, workspace, error: null });
      },
      (error) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            workspace: null,
            error: error instanceof Error ? error.message : 'Account could not be loaded.',
          });
      },
    );
    return () => controller.abort();
  }, [retry]);
  if (snapshot.retry !== retry) return <p role="status">Loading your account…</p>;
  if (snapshot.error)
    return (
      <section className="identity-panel">
        <p role="alert">{snapshot.error}</p>
        <button className="action-secondary" onClick={() => setRetry((value) => value + 1)}>
          Reconnect
        </button>
      </section>
    );
  const profile = snapshot.workspace?.profile;
  if (!profile)
    return (
      <section className="identity-panel">
        <h2>No AgentGrid membership is linked.</h2>
        <p>
          This sign-in does not currently have an AgentGrid profile. Other applications using the
          same identity are unaffected.
        </p>
        <Link prefetch={false} href="/workspace/">
          Return to your workspace
        </Link>
      </section>
    );
  if (profile.status !== 'active')
    return (
      <section className="identity-panel">
        <h2>Account access is restricted.</h2>
        <p>
          Your profile is {profile.status}. Self-service removal requires an active account; contact
          AgentGrid support for an account or data review.
        </p>
      </section>
    );
  return <AccountRemovalForm key={profile.id} profile={profile} csrf={csrf} email={email} />;
}
export function AccountControls() {
  const { identity, pending, error, reload } = useIdentity();
  if (identity?.signedIn)
    return <ConnectedAccount key={identity.email} csrf={identity.csrf} email={identity.email} />;
  if (pending) return <p role="status">Verifying your sign-in…</p>;
  return (
    <section className="identity-panel">
      <h2>Connect to manage your account.</h2>
      {error ? (
        <>
          <p role="alert">{error}</p>
          <button className="action-secondary" onClick={reload}>
            Reconnect
          </button>
        </>
      ) : (
        <Link
          prefetch={false}
          className="action-primary"
          href="/sign-in/?returnTo=%2Fworkspace%2Faccount%2F"
        >
          Sign in to AgentGrid
        </Link>
      )}
    </section>
  );
}
