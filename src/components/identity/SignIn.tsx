'use client';
import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import { signInReturnPath } from '../../domain/session';
import { communityRequest } from '../../services/community';
import { useIdentity } from './useIdentity';
import { CallbackNotice } from './CallbackNotice';

const ChallengeSchema = z.strictObject({
  challenge: z.literal('sent'),
  expiresInSeconds: z.literal(300),
});
const GoogleSchema = z.strictObject({ destination: z.url() });
const VerifiedSchema = z.strictObject({
  signedIn: z.literal(true),
  returnTo: z.string(),
  csrf: z.string(),
});
export function SignIn() {
  const { identity, pending, error: connectionError, reload } = useIdentity();
  const [email, setEmail] = useState(''),
    [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(false),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  function returnTo() {
    return signInReturnPath(new URLSearchParams(window.location.search).get('returnTo'));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!identity || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (challenge) {
        const verified = await communityRequest('/api/identity/verify/', VerifiedSchema, {
          csrf: identity.csrf,
          body: { code },
        });
        window.location.assign(signInReturnPath(verified.returnTo));
      } else {
        await communityRequest('/api/identity/email/', ChallengeSchema, {
          csrf: identity.csrf,
          body: { email, returnTo: returnTo() },
        });
        setChallenge(true);
        setNotice('Code sent. Enter it here within five minutes.');
        requestAnimationFrame(() => codeInput.current?.focus());
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign-in did not complete.');
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    if (!identity || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await communityRequest('/api/identity/google/', GoogleSchema, {
        csrf: identity.csrf,
        body: { returnTo: returnTo() },
      });
      const destination = new URL(result.destination);
      if (
        destination.protocol !== 'https:' ||
        !/^[a-z0-9]+\.supabase\.co$/.test(destination.hostname) ||
        destination.port ||
        destination.username ||
        destination.password ||
        destination.pathname !== '/auth/v1/authorize'
      )
        throw new Error('Sign-in destination could not be verified.');
      window.location.assign(destination.href);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Google sign-in did not complete.');
      setBusy(false);
    }
  }
  if (identity?.signedIn)
    return (
      <section className="identity-panel">
        <h2>You’re connected.</h2>
        <p>Signed in as {identity.email}.</p>
        <Link prefetch={false} className="action-primary" href="/workspace/">
          Open your workspace <span aria-hidden="true">↗</span>
        </Link>
      </section>
    );
  return (
    <section
      className="identity-panel"
      aria-busy={pending || busy}
      aria-labelledby="identity-title"
    >
      <p className="eyebrow">Your connection / private by default</p>
      <h2 id="identity-title">Bring your own signal.</h2>
      <p>
        Save useful agents, develop your own, and join the network. Exploring agents never requires
        an account.
      </p>
      <CallbackNotice />
      {connectionError && (
        <div role="alert">
          <p>{connectionError}</p>
          <button type="button" className="action-secondary" onClick={() => void reload()}>
            Reconnect
          </button>
        </div>
      )}
      {pending && <p role="status">Connecting securely…</p>}
      {!challenge && (
        <button
          type="button"
          className="action-secondary identity-google"
          disabled={!identity || busy}
          onClick={() => void google()}
        >
          Continue with Google <span aria-hidden="true">↗</span>
        </button>
      )}
      <form onSubmit={submit}>
        {challenge ? (
          <>
            <label htmlFor="signin-code">Your email code</label>
            <p id="code-help">Sent to {email}. Use this browser to finish signing in.</p>
            <input
              ref={codeInput}
              id="signin-code"
              name="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
              aria-describedby="code-help"
              disabled={busy}
            />
          </>
        ) : (
          <>
            <label htmlFor="signin-email">Email address</label>
            <input
              id="signin-email"
              name="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
          </>
        )}
        <button className="action-primary" disabled={!identity || busy} type="submit">
          {busy ? 'Please wait…' : challenge ? 'Verify and continue' : 'Send me a sign-in code'}{' '}
          <span aria-hidden="true">→</span>
        </button>
        {challenge && (
          <button
            type="button"
            className="identity-reset"
            disabled={busy}
            onClick={() => {
              setChallenge(false);
              setCode('');
              setError(null);
              setNotice(null);
            }}
          >
            Use another email or request a new code
          </button>
        )}
      </form>
      {notice && (
        <p role="status" className="identity-message">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="identity-error">
          {error}
        </p>
      )}
      <p className="identity-footnote">
        Signing in verifies your identity. Publishing a creator profile and accepting community
        terms are separate choices.
      </p>
    </section>
  );
}
