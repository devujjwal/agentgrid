'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { useModerationAccess } from './useModerationAccess';
import { ReviewQueue } from './ReviewQueue';
import { StaffReviewDetail } from './StaffReviewDetail';
import { useCreatorMemory } from '../authoring/CreatorMemory';

export function ReviewModeration() {
  const identity = useIdentity(),
    access = useModerationAccess(identity.identity);
  const [selected, setSelected] = useState<string | null>(null);
  const memory = useCreatorMemory();
  const notes =
    identity.identity?.signedIn && memory.moderationNotes?.email === identity.identity.email
      ? memory.moderationNotes
      : null;
  const reviewId = notes?.reviewId ?? selected;
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
        <p>This workspace is restricted to appointed AgentGrid moderators and administrators.</p>
        <Link
          prefetch={false}
          className="action-primary"
          href="/sign-in/?returnTo=%2Fworkspace%2Fmoderation%2F"
        >
          Sign in
        </Link>
      </div>
    );
  if (!access.allowed)
    return (
      <div className="moderation-notice">
        <h2>Staff access is required.</h2>
        <p>Your current account does not have active AgentGrid moderation access.</p>
        <button className="action-secondary" onClick={identity.reload}>
          Recheck staff access
        </button>
        <Link prefetch={false} href="/workspace/">
          Your workspace
        </Link>
      </div>
    );
  return reviewId ? (
    <StaffReviewDetail
      key={reviewId}
      reviewId={reviewId}
      csrf={identity.identity.csrf}
      notes={notes?.email === identity.identity.email ? notes : null}
      changeNotes={(value) => {
        setSelected(reviewId);
        memory.setModerationNotes(
          value && identity.identity?.signedIn
            ? { ...value, reviewId, email: identity.identity.email }
            : null,
        );
      }}
      back={() => {
        memory.setModerationNotes(null);
        setSelected(null);
      }}
      recheck={identity.reload}
    />
  ) : (
    <>
      <div className="moderation-toolbar">
        <p>
          Review queue <span className="moderation-live">Live data</span>
        </p>
        <Link prefetch={false} href="/workspace/">
          Your workspace ↗
        </Link>
      </div>
      <Link className="action-secondary" prefetch={false} href="/workspace/moderation/submissions/">
        Review submissions ↗
      </Link>
      <Link className="action-secondary" prefetch={false} href="/workspace/moderation/reports/">
        Investigate reports ↗
      </Link>
      <ReviewQueue select={setSelected} />
      {access.administrator && (
        <Link className="action-secondary" prefetch={false} href="/workspace/moderation/people/">
          Manage profiles and staff ↗
        </Link>
      )}
    </>
  );
}
