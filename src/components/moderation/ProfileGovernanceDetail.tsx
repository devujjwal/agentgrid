'use client';
import { useEffect, useRef, useState } from 'react';
import {
  AdminProfileSchema,
  type AdminProfile,
  type ProfileDecision,
} from '../../domain/profile-governance';
import { communityRequest } from '../../services/community';
import { useCreatorMemory, type ProfileGovernanceBuffer } from '../authoring/CreatorMemory';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { ProfileGovernanceForm } from './ProfileGovernanceForm';
export function ProfileGovernanceDetail({
  username,
  email,
  csrf,
  back,
  recheck,
}: {
  username: string;
  email: string;
  csrf: string;
  back: () => void;
  recheck: () => void;
}) {
  const memory = useCreatorMemory();
  const notes =
    memory.profileGovernance?.email === email && memory.profileGovernance.username === username
      ? memory.profileGovernance
      : null;
  const [retry, setRetry] = useState(0),
    [snapshot, setSnapshot] = useState<{
      retry: number;
      profile: AdminProfile | null;
      error: string | null;
    }>({ retry: -1, profile: null, error: null });
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState<string | null>(null);
  const [requiresRefresh, setRequiresRefresh] = useState(false);
  const operation = useRef<AbortController | null>(null),
    message = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => operation.current?.abort(), []);
  useEffect(() => {
    if (notice) message.current?.focus();
  }, [notice]);
  useEffect(() => {
    const controller = new AbortController();
    void communityRequest(
      '/api/admin/profile/?username=' + encodeURIComponent(username),
      AdminProfileSchema,
      undefined,
      controller.signal,
    ).then(
      (profile) => {
        if (!controller.signal.aborted) {
          setSnapshot({ retry, profile, error: null });
          setRequiresRefresh(false);
        }
      },
      (error) => {
        if (!controller.signal.aborted)
          setSnapshot({
            retry,
            profile: null,
            error: error instanceof Error ? error.message : 'Profile could not be loaded.',
          });
      },
    );
    return () => controller.abort();
  }, [username, retry]);
  const pending = snapshot.retry !== retry,
    profile = pending ? null : snapshot.profile;
  function change(value: ProfileGovernanceBuffer) {
    memory.setProfileGovernance(value);
    setNotice(null);
  }
  async function decide(input: ProfileDecision) {
    if (
      operation.current ||
      !profile ||
      !notes ||
      notes.uncertain ||
      input.profileId !== profile.id ||
      input.expectedRevision !== profile.revision
    )
      return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setNotice(null);
    try {
      const result = await communityRequest(
        '/api/admin/profile-decision/',
        AdminProfileSchema,
        { csrf, body: input },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (result.id !== profile.id || result.revision !== profile.revision + 1)
        throw new Error('Decision receipt differs.');
      memory.setProfileGovernance(null);
      setSnapshot({ retry, profile: result, error: null });
      setNotice(
        'The profile decision was recorded. Review the current state before another action.',
      );
      if (result.isSelf) recheck();
    } catch {
      if (!controller.signal.aborted) {
        memory.setProfileGovernance({ ...notes, uncertain: true });
        setRequiresRefresh(true);
        setNotice(
          'Decision not confirmed. Reload the live profile before any further action. Your reason is held in this tab.',
        );
      }
    } finally {
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="moderation-detail" aria-busy={pending || busy}>
      <div className="moderation-toolbar">
        {notes ? (
          <ConfirmAction
            label="Choose another profile"
            title="Discard this held decision?"
            description="Your unsent reason and selected action will be removed from this tab. Any decision already recorded remains in the audit history."
            confirmation="Discard held decision"
            disabled={busy}
            confirm={back}
          />
        ) : (
          <button className="action-secondary" disabled={busy} onClick={back}>
            Choose another profile
          </button>
        )}
        <button
          className="action-secondary"
          disabled={pending || busy}
          onClick={() => setRetry((value) => value + 1)}
        >
          Reload live profile
        </button>
      </div>
      {pending && <p role="status">Loading current profile and roles…</p>}
      {!pending && snapshot.error && (
        <div className="moderation-notice">
          <p role="alert">{snapshot.error}</p>
          <button className="action-secondary" onClick={recheck}>
            Recheck administrator access
          </button>
        </div>
      )}
      {profile && (
        <>
          <p className="eyebrow">
            @{profile.username} / revision {profile.revision}
          </p>
          <h2>{profile.displayName}</h2>
          {profile.isSelf && (
            <p className="moderation-notice">You are reviewing your own AgentGrid profile.</p>
          )}
          <dl className="moderation-facts">
            <div>
              <dt>Access</dt>
              <dd>{profile.status}</dd>
            </div>
            <div>
              <dt>Attribution</dt>
              <dd>{profile.visibility}</dd>
            </div>
            <div>
              <dt>Staff roles</dt>
              <dd>{profile.roles.join(', ') || 'None'}</dd>
            </div>
            <div>
              <dt>Membership</dt>
              <dd>{profile.linked ? 'Linked' : 'Detached'}</dd>
            </div>
          </dl>
          <p className="moderation-review-body">{profile.bio || 'No biography provided.'}</p>
          {profile.website && <p>Website: {profile.website}</p>}
          {notes && notes.profileId !== profile.id ? (
            <p role="alert" className="moderation-notice">
              A different profile now uses this username. Discard the held decision and inspect the
              person again.
            </p>
          ) : (
            <ProfileGovernanceForm
              key={profile.id + ':' + profile.revision + ':' + retry}
              profile={profile}
              email={email}
              notes={notes}
              change={change}
              busy={busy}
              canAdopt={!requiresRefresh}
              submit={(input) => void decide(input)}
            />
          )}
        </>
      )}
      {notice && (
        <p ref={message} tabIndex={-1} role="status" className="moderation-notice">
          {notice}
        </p>
      )}
    </section>
  );
}
