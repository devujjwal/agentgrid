'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useIdentity } from '../identity/useIdentity';
import { useCreatorMemory } from '../authoring/CreatorMemory';
import { useReviewContext } from './useReviewContext';
import { useReviewMutation } from './useReviewMutation';
import { reviewAccessMessage } from './ReviewAccessMessage';
import { ReviewForm } from './ReviewForm';
import { ConfirmAction } from '../feedback/ConfirmAction';
import { ReviewStatus } from './ReviewStatus';
import type { IdentityResponse } from '../../domain/session';
import type { ReviewInput } from '../../domain/reviews';

export function ReviewEditor({
  resourceId,
  label,
  path,
  changed,
}: {
  resourceId: string;
  label: string;
  path: string;
  changed: () => void;
}) {
  const identity = useIdentity(),
    access = useReviewContext(identity.identity, resourceId),
    mutation = useReviewMutation(identity.identity, resourceId, access.context),
    memory = useCreatorMemory();
  const [permission, setPermission] = useState<{
    connection: IdentityResponse | null;
    key: string | null;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null),
    refocus = useRef(false);
  const context = access.context,
    saved = context?.review;
  const buffer = memory.reviewEdits;
  const owned = identity.identity?.signedIn && buffer?.email === identity.identity.email;
  const matching = owned && buffer.input.resourceId === resourceId;
  const fields: ReviewInput = matching
    ? buffer.input
    : {
        resourceId,
        usedVersionId: saved?.usedVersionId ?? '',
        rating: saved?.rating ?? 0,
        title: saved?.title ?? '',
        body: saved?.body ?? '',
        experience: saved?.experience ?? '',
        expectedRevision: saved?.revision ?? 0,
      };
  const conflict = matching && fields.expectedRevision !== (saved?.revision ?? 0);
  const permissionKey = identity.identity?.signedIn
    ? [identity.identity.email, resourceId, fields.expectedRevision, fields.usedVersionId].join(':')
    : null;
  const approved =
    permissionKey !== null &&
    permission?.connection === identity.identity &&
    permission.key === permissionKey;
  useEffect(() => {
    if (context && refocus.current) {
      heading.current?.focus();
      refocus.current = false;
    }
  }, [context]);
  const reload = () => {
    refocus.current = true;
    access.reload();
  };
  function change(input: ReviewInput) {
    if (identity.identity?.signedIn)
      memory.setReviewEdits({ email: identity.identity.email, input, path, label });
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!approved || conflict || !context?.canReview) return;
    const confirmed = await mutation.write(fields);
    changed(); // Recheck public visibility even when write acknowledgement is uncertain.
    if (confirmed) {
      memory.setReviewEdits(null);
      setPermission(null);
      reload();
    }
  }
  async function withdraw() {
    if (!saved || mutation.busy) return;
    const confirmed = await mutation.withdraw(saved.revision);
    changed();
    if (confirmed) {
      memory.setReviewEdits(null);
      setPermission(null);
      reload();
    }
  }
  const accessMessage = reviewAccessMessage({ identity, access, reload: access.reload, path });
  if (accessMessage) return accessMessage;
  if (!context) return <p role="alert">Live review access could not be confirmed.</p>;
  if (owned && !matching)
    return (
      <>
        <p>Another review is held in this tab. Finish it before replacing its details.</p>
        <Link prefetch={false} href={buffer.path}>
          Return to {buffer.label}
        </Link>
        <ConfirmAction
          label="Discard held review"
          title="Replace your held review?"
          description="This will discard the unsaved review held in this tab. Your saved review stays unchanged."
          confirmation="Discard held review edits"
          confirm={() => memory.setReviewEdits(null)}
        />
      </>
    );
  return (
    <div className="review-editor">
      <h3 ref={heading} tabIndex={-1}>
        Your review of {label}
      </h3>
      <button className="action-secondary" disabled={mutation.busy} onClick={reload}>
        Refresh your review status
      </button>
      {saved && <ReviewStatus review={saved} />}
      {mutation.error && <p role="alert">{mutation.error}</p>}
      {conflict && (
        <div role="alert">
          <p>
            Your held edits refer to an earlier revision. Compare your saved review above; refresh
            never discards your text.
          </p>
          <ConfirmAction
            label="Use latest saved review"
            title="Use the saved revision?"
            description="Discard your held review edits and use the latest saved review shown above. Refreshing alone never discards your text."
            confirmation="Discard edits and use saved review"
            confirm={() => {
              memory.setReviewEdits(null);
              setPermission(null);
            }}
          />
        </div>
      )}
      {!context.available ? (
        <p>
          This resource is no longer available for public reviews.
          {saved && saved.state !== 'withdrawn'
            ? ' You can still withdraw your own review.'
            : saved
              ? ' Your withdrawn review remains private.'
              : ' New reviews cannot be submitted.'}
        </p>
      ) : !context.canReview ? (
        <p>Creators cannot review their own agents.</p>
      ) : (
        <ReviewForm
          fields={fields}
          context={context}
          change={change}
          submit={submit}
          busy={mutation.busy}
          conflict={Boolean(conflict) || mutation.needsRecovery}
          approved={approved}
          approve={(value) =>
            setPermission(value ? { connection: identity.identity, key: permissionKey } : null)
          }
        />
      )}
      <div className="review-action-row">
        {saved && saved.state !== 'withdrawn' && (
          <ConfirmAction
            label="Withdraw your review"
            title="Withdraw from public display?"
            description="Your review and rating will leave public display. Your saved text remains private to you and authorized staff. You can resubmit it for fresh moderation later."
            confirmation="Confirm review withdrawal"
            disabled={mutation.busy || Boolean(matching) || mutation.needsRecovery}
            confirm={() => void withdraw()}
          />
        )}
        {matching && !conflict && (
          <ConfirmAction
            label="Discard unsaved review edits"
            title="Discard your held edits?"
            description="Discard the unsaved review edits held in this tab. Your saved review stays unchanged."
            confirmation="Discard unsaved edits"
            disabled={mutation.busy}
            confirm={() => {
              memory.setReviewEdits(null);
              setPermission(null);
            }}
          />
        )}
      </div>
    </div>
  );
}
