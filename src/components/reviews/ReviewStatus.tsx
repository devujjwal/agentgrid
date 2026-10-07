import type { OwnedReview } from '../../domain/reviews';

const labels = {
  pending: 'Awaiting moderation',
  published: 'Approved for public display',
  hidden: 'Hidden by moderation',
  withdrawn: 'Withdrawn by you',
};
export function ReviewStatus({ review }: { review: OwnedReview }) {
  return (
    <div className="review-status">
      <p className="eyebrow">Your saved review / revision {review.revision}</p>
      <h4>{labels[review.state]}</h4>
      <p>
        Version {review.version} · your rating {review.rating} out of 5.
      </p>
      {review.state === 'pending' && (
        <p>
          It does not contribute to the public rating until moderation approves it. Edits go through
          moderation again.
        </p>
      )}
      {review.state === 'published' && (
        <p>Public visibility also depends on the agent and your membership remaining active.</p>
      )}
      {review.state === 'withdrawn' && (
        <p>
          It is excluded from public reviews and ratings. Staff cannot republish it. Resubmitting it
          requires fresh moderation.
        </p>
      )}
      {review.reason && <p className="review-text">Moderation response: {review.reason}</p>}
      <details>
        <summary>Compare your saved review</summary>
        <h5>{review.title}</h5>
        <p className="review-text">{review.experience}</p>
        <p className="review-text">{review.body}</p>
      </details>
    </div>
  );
}
