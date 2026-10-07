'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import {
  WorkspaceIdentitySchema,
  WorkspaceListSchema,
  type WorkspaceIdentity,
  type WorkspaceList,
} from '../../domain/workspace';
import { communityRequest } from '../../services/community';
import { useIdentity } from '../identity/useIdentity';
import { ProfileEditor, type ProfileEditBuffer } from './ProfileEditor';
import { Onboarding } from './Onboarding';
import { WorkspaceResources } from './WorkspaceResources';
import { useCreatorMemory } from '../authoring/CreatorMemory';

function ConnectedWorkspace({
  csrf,
  email,
  signedOut,
  edits,
  changeEdits,
  committed,
}: {
  csrf: string;
  email: string;
  signedOut: (csrf: string) => void;
  edits: ProfileEditBuffer | null;
  changeEdits: (value: ProfileEditBuffer) => void;
  committed: (profileId: string) => void;
}) {
  const router = useRouter();
  const [retry, setRetry] = useState(0),
    [offset, setOffset] = useState(0);
  const [snapshot, setSnapshot] = useState<{
    retry: number;
    offset: number;
    identity: WorkspaceIdentity | null;
    list: WorkspaceList | null;
    error: string | null;
  }>({ retry: -1, offset: -1, identity: null, list: null, error: null });
  const [busy, setBusy] = useState(false),
    [logoutError, setLogoutError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest('/api/workspace/', WorkspaceIdentitySchema, undefined, controller.signal)
      .then(async (identity) => {
        const list =
          identity.profile?.status === 'active'
            ? await communityRequest(
                '/api/workspace/agents/?offset=' + offset,
                WorkspaceListSchema,
                undefined,
                controller.signal,
              )
            : null;
        if (!controller.signal.aborted) setSnapshot({ retry, offset, identity, list, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            offset,
            identity: null,
            list: null,
            error: error instanceof Error ? error.message : 'Workspace could not be loaded.',
          });
      });
    return () => controller.abort();
  }, [retry, offset]);
  async function logout() {
    setBusy(true);
    setLogoutError(null);
    try {
      const result = await communityRequest(
        '/api/identity/logout/',
        z.strictObject({ signedIn: z.literal(false), csrf: z.string() }),
        { csrf, body: {} },
      );
      signedOut(result.csrf); // Unmount private state before navigating away.
      router.replace('/sign-in/');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Sign-out did not complete.');
      setBusy(false);
    }
  }
  const pending = snapshot.retry !== retry || snapshot.offset !== offset;
  const refresh = () => setRetry((value) => value + 1);
  return (
    <>
      <header className="workspace-heading">
        <div>
          <p className="eyebrow">Your network / private workspace</p>
          <h1>
            A space for
            <br />
            <em>useful intelligence.</em>
          </h1>
        </div>
        <div className="workspace-session">
          <p>Connected as {email}</p>
          <Link prefetch={false} href="/saves/">
            Your saved agents
          </Link>
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void logout()}
          >
            {busy ? 'Signing out…' : 'Sign out'}
          </button>
          {logoutError && <p role="alert">{logoutError}</p>}
        </div>
      </header>
      <div className="workspace-body" aria-busy={pending}>
        {pending && <p role="status">Loading your workspace…</p>}
        {snapshot.error && (
          <section className="identity-panel">
            <h2>Connection interrupted.</h2>
            <p role="alert">{snapshot.error}</p>
            <button className="action-secondary" onClick={refresh}>
              Reconnect
            </button>
          </section>
        )}
        {snapshot.identity && !snapshot.identity.profile && (
          <Onboarding configuration={snapshot.identity.onboarding} csrf={csrf} refresh={refresh} />
        )}
        {snapshot.identity?.profile?.status === 'active' && (
          <>
            <WorkspaceResources
              list={snapshot.list}
              pending={pending}
              offset={offset}
              changeOffset={setOffset}
            />
            <ProfileEditor
              key={snapshot.identity.profile.id}
              profile={snapshot.identity.profile}
              csrf={csrf}
              refresh={refresh}
              fields={
                edits?.owner === email &&
                edits.profileId === snapshot.identity.profile.id &&
                (edits.dirty || pending)
                  ? edits.fields
                  : {
                      displayName: snapshot.identity.profile.displayName,
                      bio: snapshot.identity.profile.bio,
                      website: snapshot.identity.profile.website ?? '',
                    }
              }
              change={(fields) => {
                if (snapshot.identity?.profile)
                  changeEdits({
                    owner: email,
                    profileId: snapshot.identity.profile.id,
                    fields,
                    dirty: true,
                  });
              }}
              committed={committed}
            />
          </>
        )}
        {snapshot.identity?.profile && snapshot.identity.profile.status !== 'active' && (
          <section className="identity-panel">
            <h2>Workspace access is restricted.</h2>
            <p>
              Your profile is {snapshot.identity.profile.status}. Editing and community actions are
              unavailable.
            </p>
            <Link prefetch={false} href="/agents/">
              Continue exploring agents
            </Link>
          </section>
        )}
      </div>
    </>
  );
}
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
          changeEdits(null);
          memory.setBuffer(null);
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
      {!pending && !error && (
        <>
          <p>Sign in to keep your saved agents and work in progress together.</p>
          <Link
            prefetch={false}
            className="action-primary"
            target={memory.buffer?.dirty || edits?.dirty ? '_blank' : undefined}
            rel={memory.buffer?.dirty || edits?.dirty ? 'noopener noreferrer' : undefined}
            href="/sign-in/?returnTo=%2Fworkspace%2F"
          >
            Connect to AgentGrid <span aria-hidden="true">→</span>
          </Link>
        </>
      )}
    </section>
  );
}
