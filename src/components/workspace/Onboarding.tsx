'use client';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { WorkspaceIdentity } from '../../domain/workspace';
import { communityRequest } from '../../services/community';
export function Onboarding({
  configuration,
  csrf,
  refresh,
}: {
  configuration: WorkspaceIdentity['onboarding'];
  csrf: string;
  refresh: () => void;
}) {
  const [username, setUsername] = useState(''),
    [displayName, setDisplayName] = useState('');
  const [terms, setTerms] = useState(false),
    [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await communityRequest(
        '/api/workspace/onboard/',
        z.strictObject({ updated: z.literal(true) }),
        {
          csrf,
          body: {
            username,
            displayName,
            termsVersion: configuration.termsVersion,
            privacyVersion: configuration.privacyVersion,
            acceptsTerms: terms,
            acknowledgesPrivacy: privacy,
          },
        },
      );
      refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Joining did not complete.');
    } finally {
      setBusy(false);
    }
  }
  if (!configuration.enabled || !configuration.termsVersion || !configuration.privacyVersion)
    return (
      <section className="identity-panel">
        <p className="eyebrow">Identity verified</p>
        <h2>A profile is your choice.</h2>
        <p>
          Community registration is currently closed. You can continue exploring without creating a
          public identity.
        </p>
        <Link prefetch={false} className="action-secondary" href="/agents/">
          Explore agents <span aria-hidden="true">↗</span>
        </Link>
      </section>
    );
  return (
    <section className="identity-panel" aria-labelledby="join-title" aria-busy={busy}>
      <p className="eyebrow">Your place / choose your identity</p>
      <h2 id="join-title">Join the network.</h2>
      <p>Your profile starts private. You decide when to enable public attribution.</p>
      <form onSubmit={submit}>
        <label htmlFor="join-username">Username</label>
        <input
          id="join-username"
          name="username"
          autoComplete="username"
          pattern="[a-z][a-z0-9_]{2,29}"
          minLength={3}
          maxLength={30}
          required
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={busy}
          aria-describedby="username-help"
        />
        <p id="username-help">
          3–30 characters. Start with a lowercase letter; use lowercase letters, numbers or
          underscores. Usernames remain attached to your work.
        </p>
        <label htmlFor="join-name">Display name</label>
        <input
          id="join-name"
          name="displayName"
          required
          minLength={2}
          maxLength={80}
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={busy}
        />
        <label className="identity-checkbox">
          <input
            name="terms"
            type="checkbox"
            required
            checked={terms}
            onChange={(event) => setTerms(event.target.checked)}
            disabled={busy}
          />
          <span>
            I accept the{' '}
            <Link prefetch={false} href="/terms/">
              community terms
            </Link>
            .
          </span>
        </label>
        <label className="identity-checkbox">
          <input
            name="privacy"
            type="checkbox"
            required
            checked={privacy}
            onChange={(event) => setPrivacy(event.target.checked)}
            disabled={busy}
          />
          <span>
            I have read the{' '}
            <Link prefetch={false} href="/privacy/">
              privacy notice
            </Link>
            .
          </span>
        </label>
        <button type="submit" className="action-primary" disabled={busy || !terms || !privacy}>
          {busy ? 'Joining…' : 'Create my profile'} <span aria-hidden="true">→</span>
        </button>
      </form>
      {error && (
        <p className="identity-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
