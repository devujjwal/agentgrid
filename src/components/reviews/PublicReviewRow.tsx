import Link from 'next/link';
import { ReportResource } from '../reporting/ReportResource';
import type { PublicReviews } from '../../domain/reviews';

export function PublicReviewRow({
  review,
  path,
}: {
  review: PublicReviews['reviews'][number];
  path: string;
}) {
  return (
    <li>
      <article aria-labelledby={'public-review-' + review.id}>
        <header>
          <h3 id={'public-review-' + review.id}>{review.title}</h3>
          <span className="review-rating-value">{review.rating} / 5</span>
        </header>
        <p className="review-byline">
          {review.author.username ? (
            <Link prefetch={false} href={'/creators/' + review.author.username + '/'}>
              {review.author.name}
            </Link>
          ) : (
            review.author.name
          )}{' '}
          · version {review.version} ·{' '}
          <time dateTime={review.updatedAt}>
            {new Date(review.updatedAt).toLocaleDateString('en', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </p>
        <div className="review-use-context">
          <h4>Used for</h4>
          <p className="review-text">{review.experience}</p>
        </div>
        <p className="review-text">{review.body}</p>
        <ReportResource
          targetKind="review"
          targetId={review.id}
          label={'review: ' + review.title}
          path={path}
        />
      </article>
    </li>
  );
}
