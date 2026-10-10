'use client';
import Link from 'next/link';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { ConnectedWorkspace } from './ConnectedWorkspace';

export function Workspace() {
  const { identity, pending, error, reload, signedOut } = useIdentity();
  const memory = useCreatorMemory();
  const { profileEdits: edits, setProfileEdits: changeEdits } = memory;
  if (identity?.signedIn)
    return (
      <ConnectedWorkspace
        csrf={identity.csrf}
        email={identity.email}
        edits={edits}
        changeEdits={changeEdits}
        committed={(profileId) =>
          changeEdits((current) =>
            current?.owner === identity.email && current.profileId === profileId
              ? { ...current, dirty: false }
              : current,
          )
        }
        signedOut={(csrf) => {
          memory.clear();
          signedOut(csrf);
        }}
      />
    );
  return (
    <section className="workspace-connect identity-panel">
      <p className="eyebrow">Your network / private workspace</p>
      <h1>{pending ? 'Connecting…' : 'Make this space yours.'}</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <button type="button" className="action-secondary" onClick={reload}>
            Reconnect
          </button>
        </>
      )}
      <p>
        Create a portrait video from your own media without signing in.{' '}
        <a href="/workspace/reels/">Create a free reel →</a>
      </p>
      {!pending && !error && (
        <>
          <p>Sign in to keep your saved agents and work in progress together.</p>
          <Link
            prefetch={false}
            className="action-primary"
            target={memory.hasUnsaved ? '_blank' : undefined}
            rel={memory.hasUnsaved ? 'noopener noreferrer' : undefined}
            href="/sign-in/?returnTo=%2Fworkspace%2F"
          >
            Connect to AgentGrid <span aria-hidden="true">→</span>
          </Link>
        </>
      )}
    </section>
  );
}
