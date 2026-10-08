'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { useModerationAccess } from './useModerationAccess';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { ProfileSchema } from '../../domain/workspace';
import { ProfileGovernanceDetail } from './ProfileGovernanceDetail';
export function ProfileAdministration() {
  const identity = useIdentity(),
    access = useModerationAccess(identity.identity),
    memory = useCreatorMemory();
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState<string | null>(null);
  if (identity.pending || access.pending)
    return <p role="status">Verifying administrator access…</p>;
  if (identity.error || access.error)
    return (
      <section className="moderation-notice">
        <p role="alert">{identity.error ?? access.error}</p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck access
        </button>
      </section>
    );
  if (!identity.identity?.signedIn)
    return (
      <section className="moderation-notice">
        <h2>Sign in to continue.</h2>
        <p>Only appointed AgentGrid administrators can inspect profiles or change staff access.</p>
        <Link prefetch={false} href="/sign-in/?returnTo=%2Fworkspace%2Fmoderation%2Fpeople%2F">
          Sign in
        </Link>
      </section>
    );
  if (!access.administrator)
    return (
      <section className="moderation-notice">
        <h2>Administrator access is required.</h2>
        <p>Your account does not currently have this authority.</p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck access
        </button>
        <Link prefetch={false} href="/workspace/">
          Your workspace
        </Link>
      </section>
    );
  const email = identity.identity.email,
    notes = memory.profileGovernance?.email === email ? memory.profileGovernance : null;
  const username = notes?.username ?? selected;
  return (
    <>
      <div className="moderation-toolbar">
        <p>
          Profiles and staff <span className="moderation-live">Live authority</span>
        </p>
        <Link prefetch={false} href="/workspace/moderation/">
          Moderation workspace ↗
        </Link>
      </div>
      {username ? (
        <ProfileGovernanceDetail
          key={username}
          username={username}
          email={email}
          csrf={identity.identity.csrf}
          recheck={identity.reload}
          back={() => {
            memory.setProfileGovernance(null);
            setSelected(null);
          }}
        />
      ) : (
        <form
          className="moderation-fields moderation-detail"
          onSubmit={(event) => {
            event.preventDefault();
            if (ProfileSchema.shape.username.safeParse(query).success) setSelected(query);
          }}
        >
          <h2>Find the person behind a signal.</h2>
          <p>
            Enter their exact AgentGrid username, without @. This control does not search email
            addresses or shared authentication records.
          </p>
          <label htmlFor="admin-profile-query">AgentGrid username</label>
          <input
            id="admin-profile-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            maxLength={30}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            pattern="[a-z][a-z0-9_]{2,29}"
          />
          <button className="action-primary" type="submit">
            Inspect profile
          </button>
        </form>
      )}
    </>
  );
}
