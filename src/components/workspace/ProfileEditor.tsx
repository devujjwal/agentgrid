'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { WorkspaceIdentity } from '../../domain/workspace';
import { communityRequest } from '../../services/community';
export interface ProfileFields {
  displayName: string;
  bio: string;
  website: string;
}
export interface ProfileEditBuffer {
  owner: string;
  profileId: string;
  fields: ProfileFields;
  dirty: boolean;
}
const Updated = z.strictObject({ updated: z.literal(true) });
export function ProfileEditor({
  profile,
  csrf,
  refresh,
  fields,
  change,
  committed,
}: {
  profile: NonNullable<WorkspaceIdentity['profile']>;
  csrf: string;
  refresh: () => void;
  fields: ProfileFields;
  change: (fields: ProfileFields) => void;
  committed: (profileId: string) => void;
}) {
  const { displayName, bio, website } = fields;
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await communityRequest(
        '/api/workspace/profile/',
        Updated,
        {
          csrf,
          body: { displayName, bio, website },
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      committed(profile.id);
      setMessage('Profile saved.');
      refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Profile could not be saved.');
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  async function visibility() {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await communityRequest(
        '/api/workspace/visibility/',
        Updated,
        {
          csrf,
          body: { public: profile.visibility !== 'public' },
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setMessage(
        profile.visibility === 'public'
          ? 'Public attribution turned off.'
          : 'Public attribution turned on.',
      );
      refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : 'Visibility could not be updated.');
    } finally {
      if (active.current === controller) active.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="identity-panel workspace-profile"
      aria-labelledby="profile-title"
      aria-busy={busy}
    >
      <p className="eyebrow">Identity / @{profile.username}</p>
      <h2 id="profile-title">How you appear.</h2>
      <form onSubmit={submit}>
        <label htmlFor="profile-name">Display name</label>
        <input
          id="profile-name"
          name="displayName"
          required
          minLength={2}
          maxLength={80}
          value={displayName}
          onChange={(event) => change({ ...fields, displayName: event.target.value })}
          disabled={busy}
        />
        <label htmlFor="profile-bio">
          About you <span className="field-optional">(optional)</span>
        </label>
        <textarea
          id="profile-bio"
          name="bio"
          rows={5}
          maxLength={1600}
          value={bio}
          onChange={(event) => change({ ...fields, bio: event.target.value })}
          disabled={busy}
        />
        <label htmlFor="profile-website">
          Website <span className="field-optional">(optional, HTTPS)</span>
        </label>
        <input
          id="profile-website"
          name="website"
          type="url"
          maxLength={2048}
          value={website}
          onChange={(event) => change({ ...fields, website: event.target.value })}
          disabled={busy}
        />
        <button className="action-primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'} <span aria-hidden="true">→</span>
        </button>
      </form>
      <p>
        Public attribution is <strong>{profile.visibility === 'public' ? 'on' : 'off'}</strong>.
        Your email and saved list stay private.
      </p>
      <button
        type="button"
        className="action-secondary"
        disabled={busy}
        onClick={() => void visibility()}
      >
        {profile.visibility === 'public'
          ? 'Turn off public attribution'
          : 'Turn on public attribution'}
      </button>
      {message && (
        <p role="status" className="identity-message">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="identity-error">
          {error}
        </p>
      )}
    </section>
  );
}
