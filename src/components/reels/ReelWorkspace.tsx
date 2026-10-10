'use client';
import Link from 'next/link';
import { useIdentity } from '../identity/useIdentity';
import { ConnectedMediaWorkspace } from './ConnectedMediaWorkspace';
export function ReelWorkspace() {
  const session = useIdentity();
  return (
    <section className="identity-panel">
      <h1>Reels and publishing</h1>
      <p>Plan your video, review its cost and choose where to publish it.</p>
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
      <p>
        <Link href="/workspace/">Back to your workspace</Link>
      </p>
    </section>
  );
}
