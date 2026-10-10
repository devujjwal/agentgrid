'use client';
import Link from 'next/link';
import { useIdentity } from '../identity/useIdentity';
import { ReelPlanner } from './ReelPlanner';
export function ReelWorkspace() {
  const session = useIdentity();
  return (
    <section className="identity-panel">
      <h1>Plan a reel</h1>
      <p>Write your narration and map out a short portrait video.</p>
      {session.pending ? (
        <p role="status">Checking your session…</p>
      ) : session.error ? (
        <p role="alert">{session.error}</p>
      ) : session.identity?.signedIn ? (
        <ReelPlanner />
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
