'use client';
import Link from 'next/link';
import { useIdentity } from '../identity/useIdentity';
import { ConnectedMediaWorkspace } from './ConnectedMediaWorkspace';
import { LocalReelEditor } from './local/LocalReelEditor';
export function ReelWorkspace() {
  const session = useIdentity();
  return (
    <section className="identity-panel">
      <h1>Reels and publishing</h1>
      <p>Create a reel from your own media, right in your browser.</p>
      <LocalReelEditor />
      <details className="cloud-reel-controls">
        <summary>Agent runs and connected publishing</summary>
        <p className="media-help">
          Cloud execution and publishing remain disabled. Local reel creation above uses no provider
          or hosting budget.
        </p>
        {session.pending ? (
          <p role="status">Checking your session…</p>
        ) : session.error ? (
          <p role="alert">{session.error}</p>
        ) : session.identity?.signedIn ? (
          <ConnectedMediaWorkspace key={session.identity.csrf} csrf={session.identity.csrf} />
        ) : (
          <p>
            <Link href="/sign-in/?next=%2Fworkspace%2Freels%2F">Sign in to plan a reel</Link>
          </p>
        )}
      </details>
      <p>
        <Link href="/workspace/">Back to your workspace</Link>
      </p>
    </section>
  );
}
