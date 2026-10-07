import Link from 'next/link';
import type { useIdentity } from '../identity/useIdentity';
import type { useReviewContext } from './useReviewContext';

export function reviewAccessMessage({
  identity,
  access,
  reload,
  path,
}: {
  identity: ReturnType<typeof useIdentity>;
  access: ReturnType<typeof useReviewContext>;
  reload: () => void;
  path: string;
}) {
  if (identity.pending || access.pending)
    return <p role="status">Verifying your identity and live review access…</p>;
  if (identity.error || access.error)
    return (
      <>
        <p role="alert">{identity.error ?? access.error}</p>
        <button
          className="action-secondary"
          onClick={() => (identity.error ? identity.reload() : reload())}
        >
          Reconnect review access
        </button>
      </>
    );
  if (!identity.identity?.signedIn)
    return (
      <>
        <p>Sign in to share a review based on using this agent. Public reviews are moderated.</p>
        <Link
          prefetch={false}
          className="action-secondary"
          href={'/sign-in/?returnTo=' + encodeURIComponent(path)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Sign in in another tab
        </Link>
        <p>Return here after signing in.</p>
        <button className="action-secondary" onClick={identity.reload}>
          Reconnect after signing in
        </button>
      </>
    );
  if (!access.workspace?.profile)
    return (
      <>
        <p>Join the AgentGrid community before writing a review.</p>
        <Link prefetch={false} className="action-secondary" href="/workspace/">
          Open your workspace
        </Link>
      </>
    );
  if (access.workspace.profile.status !== 'active')
    return (
      <>
        <p role="alert">
          Review access is unavailable while your profile is {access.workspace.profile.status}.
        </p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck review access
        </button>
      </>
    );

  return null;
}
