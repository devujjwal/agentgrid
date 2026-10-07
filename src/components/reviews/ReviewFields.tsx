import type { ReviewInput, ReviewContext } from '../../domain/reviews';

const ratings = [
  'Not useful',
  'Limited usefulness',
  'Useful with changes',
  'Very useful',
  'Excellent for this task',
];
export function ReviewFields({
  fields,
  context,
  change,
  disabled,
}: {
  fields: ReviewInput;
  context: ReviewContext;
  change: (value: ReviewInput) => void;
  disabled: boolean;
}) {
  const key = fields.resourceId;
  const versions = context.currentVersion ? [context.currentVersion] : [];
  if (context.review && !versions.some((version) => version.id === context.review?.usedVersionId))
    versions.push({ id: context.review.usedVersionId, version: context.review.version });
  return (
    <>
      <label htmlFor={'review-version-' + key}>Version you actually used</label>
      <select
        id={'review-version-' + key}
        value={fields.usedVersionId}
        required
        disabled={disabled}
        onChange={(event) => change({ ...fields, usedVersionId: event.target.value })}
      >
        <option value="">Choose a version</option>
        {versions.map((version) => (
          <option key={version.id} value={version.id}>
            {version.version}
            {version.id === context.currentVersion?.id
              ? ' · current release'
              : ' · previously reviewed'}
          </option>
        ))}
      </select>
      <fieldset className="review-rating" disabled={disabled}>
        <legend>How useful was it for your task?</legend>
        {ratings.map((label, index) => (
          <label key={label}>
            <input
              type="radio"
              name={'review-rating-' + key}
              value={index + 1}
              required
              checked={fields.rating === index + 1}
              onChange={() => change({ ...fields, rating: index + 1 })}
            />
            <span>
              <strong>{index + 1}</strong> {label}
            </span>
          </label>
        ))}
      </fieldset>
      <label htmlFor={'review-title-' + key}>A short, specific summary</label>
      <input
        id={'review-title-' + key}
        required
        minLength={10}
        maxLength={140}
        value={fields.title}
        disabled={disabled}
        onChange={(event) => change({ ...fields, title: event.target.value })}
      />
      <label htmlFor={'review-experience-' + key}>What did you use it for?</label>
      <textarea
        id={'review-experience-' + key}
        rows={3}
        required
        minLength={40}
        maxLength={1000}
        value={fields.experience}
        disabled={disabled}
        aria-describedby={'review-experience-length-' + key}
        onChange={(event) => change({ ...fields, experience: event.target.value })}
      />
      <p id={'review-experience-length-' + key}>
        {fields.experience.length} / 1,000 characters · at least 40
      </p>
      <label htmlFor={'review-body-' + key}>What worked, and what would you change?</label>
      <textarea
        id={'review-body-' + key}
        rows={7}
        required
        minLength={80}
        maxLength={4000}
        value={fields.body}
        disabled={disabled}
        aria-describedby={'review-body-length-' + key}
        onChange={(event) => change({ ...fields, body: event.target.value })}
      />
      <p id={'review-body-length-' + key}>{fields.body.length} / 4,000 characters · at least 80</p>
    </>
  );
}
