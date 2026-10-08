'use client';
import type { WorkspaceIdentity } from '../../domain/workspace';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { useAccountRemoval } from './useAccountRemoval';
export function AccountRemovalForm({
  profile,
  csrf,
  email,
}: {
  profile: NonNullable<WorkspaceIdentity['profile']>;
  csrf: string;
  email: string;
}) {
  const {
    memory,
    username,
    setUsername,
    acknowledged,
    setAcknowledged,
    state,
    error,
    notice,
    message,
    remove,
    check,
    signOut,
    signingOut,
  } = useAccountRemoval({ profile, csrf, email });
  return (
    <section
      className="identity-panel account-removal"
      aria-labelledby="account-removal-title"
      aria-busy={state === 'removing' || state === 'checking' || signingOut}
    >
      <p className="eyebrow">Account / @{profile.username}</p>
      <h2 id="account-removal-title">
        {state === 'removed' ? 'Your membership is closed.' : 'Leave AgentGrid.'}
      </h2>
      {state !== 'removed' && (
        <>
          <p>
            This action permanently removes your private working drafts and saved list. Download
            anything you need from your workspace first.
          </p>
          <ul>
            <li>
              Your agents are archived, pending submissions withdrawn, and public reviews hidden.
            </li>
            <li>
              Your profile is deidentified. Submitted versions (including unpublished ones), fork
              attribution and necessary moderation/security records are retained.
            </li>
            <li>
              Your shared sign-in identity and accounts in other applications remain unchanged.
            </li>
          </ul>
          <p>
            Deactivation cannot restore your drafts later. Signing up again creates a new AgentGrid
            profile.
          </p>
          {memory.hasUnsaved && (
            <p className="identity-error">
              You have edits held in this tab. They will also be discarded when removal is
              confirmed.
            </p>
          )}
          <label htmlFor="remove-username">
            Type <strong>{profile.username}</strong> to confirm this account
          </label>
          <input
            id="remove-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            disabled={state !== 'ready'}
          />
          <label className="account-acknowledgement">
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={state !== 'ready'}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <span>
              I understand that my private drafts and saved list will be permanently removed, and
              that retained version and security records are not erased.
            </span>
          </label>
          <ConfirmAction
            label={state === 'removing' ? 'Deactivating…' : 'Deactivate my AgentGrid account'}
            title="Permanently remove your drafts and saves?"
            description={`This closes @${profile.username} on AgentGrid. Your private drafts, saved list and held edits cannot be recovered through the application. Your shared sign-in remains available to other applications.`}
            confirmation="Deactivate and remove private drafts"
            disabled={state !== 'ready' || username !== profile.username || !acknowledged}
            confirm={() => void remove()}
          />
        </>
      )}
      {state === 'removed' && (
        <>
          <p>
            Some version and security records remain. This action does not erase every historical
            record. Your shared authentication identity was not deleted.
          </p>
          <button
            className="action-secondary"
            type="button"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            {signingOut ? 'Signing out…' : 'Sign out of this AgentGrid session'}
          </button>
        </>
      )}
      {(state === 'uncertain' || state === 'checking') && (
        <button
          className="action-secondary"
          type="button"
          disabled={state === 'checking'}
          onClick={() => void check()}
        >
          {state === 'checking' ? 'Checking account…' : 'Check live account status'}
        </button>
      )}
      {(error || notice) && (
        <p
          ref={message}
          tabIndex={-1}
          role={error ? 'alert' : 'status'}
          className={error ? 'identity-error' : 'identity-message'}
        >
          {error ?? notice}
        </p>
      )}
    </section>
  );
}
