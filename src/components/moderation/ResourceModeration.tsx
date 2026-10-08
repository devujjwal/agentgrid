'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { useIdentity } from '../identity/useIdentity';
import { useModerationAccess } from './useModerationAccess';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { StaffResourceDetail } from './StaffResourceDetail';
export function ResourceModeration() {
  const query = useSearchParams(),
    identity = useIdentity(),
    access = useModerationAccess(identity.identity),
    memory = useCreatorMemory();
  const parsed = z.uuid().safeParse(query.get('resourceId'));
  const resourceId = parsed.success && query.size === 1 ? parsed.data : null;
  const path = '/workspace/moderation/agent/' + (resourceId ? '?resourceId=' + resourceId : '');
  if (identity.pending || access.pending)
    return <p role="status">Verifying your identity and staff access…</p>;
  if (identity.error || access.error)
    return (
      <div className="moderation-notice">
        <p role="alert">{identity.error ?? access.error}</p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck staff access
        </button>
      </div>
    );
  if (!identity.identity?.signedIn)
    return (
      <div className="moderation-notice">
        <h2>Sign in to continue.</h2>
        <p>Agent access decisions are restricted to appointed AgentGrid staff.</p>
        <Link
          prefetch={false}
          className="action-primary"
          href={'/sign-in/?returnTo=' + encodeURIComponent(path)}
        >
          Sign in
        </Link>
      </div>
    );
  if (!access.allowed)
    return (
      <div className="moderation-notice">
        <h2>Staff access is required.</h2>
        <p>Your account does not have active AgentGrid moderation access.</p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck staff access
        </button>
      </div>
    );
  const notes =
    memory.resourceModerationNotes?.email === identity.identity.email &&
    memory.resourceModerationNotes.resourceId === resourceId
      ? memory.resourceModerationNotes
      : null;
  return (
    <>
      <nav className="moderation-toolbar" aria-label="Moderation workspaces">
        <Link prefetch={false} href="/workspace/moderation/reports/">
          Report investigations ↗
        </Link>
        <Link prefetch={false} href="/workspace/moderation/submissions/">
          Submission review ↗
        </Link>
        <Link prefetch={false} href="/workspace/">
          Your workspace ↗
        </Link>
      </nav>
      {resourceId ? (
        <StaffResourceDetail
          key={resourceId}
          resourceId={resourceId}
          csrf={identity.identity.csrf}
          notes={notes}
          changeNotes={(value) =>
            memory.setResourceModerationNotes(
              value && identity.identity?.signedIn
                ? { ...value, resourceId, email: identity.identity.email }
                : null,
            )
          }
          recheck={identity.reload}
        />
      ) : (
        <div className="moderation-notice">
          <h2>Choose an agent from an investigation.</h2>
          <p>
            Open agent access from a report or submitted version to review the correct resource.
          </p>
        </div>
      )}
    </>
  );
}
