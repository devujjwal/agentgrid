import type { FormEvent } from 'react';
import type { ReviewContext, ReviewInput } from '../../domain/reviews';
import { ReviewFields } from './ReviewFields';

export function ReviewForm({
  fields,
  context,
  change,
  submit,
  busy,
  conflict,
  approved,
  approve,
}: {
  fields: ReviewInput;
  context: ReviewContext;
  change: (input: ReviewInput) => void;
  submit: (event: FormEvent) => Promise<void>;
  busy: boolean;
  conflict: boolean;
  approved: boolean;
  approve: (value: boolean) => void;
}) {
  const resourceId = fields.resourceId;
  const saved = context.review;
  const changed =
    !saved ||
    saved.state === 'withdrawn' ||
    fields.usedVersionId !== saved.usedVersionId ||
    fields.rating !== saved.rating ||
    fields.title.trim() !== saved.title ||
    fields.body.trim() !== saved.body ||
    fields.experience.trim() !== saved.experience;
  return (
    <form className="review-form" onSubmit={(event) => void submit(event)} aria-busy={busy}>
      <p id={'review-sharing-' + resourceId}>
        Your rating, review and usage context become public only after moderation. Your byline
        follows profile visibility; private profiles appear as “Community member”. Leave out
        passwords, tokens and personal information.
      </p>
      <ReviewFields fields={fields} context={context} change={change} disabled={busy || conflict} />
      <label className="review-permission">
        <input
          type="checkbox"
          required
          checked={approved}
          disabled={busy || conflict}
          onChange={(event) => approve(event.target.checked)}
        />
        I used this version and can share these details publicly.
      </label>
      {!changed && <p>Edit your saved review above to send an updated version for moderation.</p>}
      <button className="action-primary" disabled={busy || conflict || !approved || !changed}>
        {busy
          ? 'Confirming…'
          : context.review?.state === 'withdrawn'
            ? 'Resubmit for moderation'
            : context.review
              ? 'Send edited review for moderation'
              : 'Send review for moderation'}
      </button>
    </form>
  );
}
