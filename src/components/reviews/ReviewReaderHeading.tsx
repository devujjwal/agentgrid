import type { Ref } from 'react';

export function ReviewReaderHeading({
  heading,
  refresh,
  pending,
}: {
  heading?: Ref<HTMLHeadingElement>;
  refresh?: () => void;
  pending: boolean;
}) {
  return (
    <>
      <header className="review-feed-heading">
        <div>
          <p className="eyebrow">Live / from people who used it</p>
          <h2 ref={heading} tabIndex={-1}>
            Experience, connected.
          </h2>
        </div>
        <button className="action-secondary" disabled={pending} onClick={refresh}>
          Refresh public reviews
        </button>
      </header>
      <p>
        Reviews describe a specific version and workflow. Ratings include only approved, visible
        reviews.
      </p>
    </>
  );
}
