'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { ReviewReaderHeading } from './ReviewReaderHeading';
import './reviews.css';

function ReviewLoading() {
  return (
    <>
      <ReviewReaderHeading pending />
      <button className="action-secondary" disabled>
        Write or manage your review
      </button>
      <div className="review-live-feed" aria-busy="true">
        <p role="status">Reading live reviews…</p>
      </div>
    </>
  );
}

const PublicReviews = dynamic(
  () => import('./PublicReviews').then((module) => module.PublicReviews),
  {
    loading: () => <ReviewLoading />,
  },
);
/** Read-only community code waits until this section approaches the viewport.
 * Identity/editor code loads only after the visitor asks to write or manage a review. */
export function ReviewResource(props: { resourceId: string; label: string; path: string }) {
  const section = useRef<HTMLElement>(null),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!section.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(section.current);
    return () => observer.disconnect();
  }, []);
  return (
    <section id="reviews" className="review-resource" ref={section} aria-label="Agent reviews">
      {visible ? <PublicReviews {...props} /> : <ReviewLoading />}
      <noscript>
        <p>
          Live reviews and review writing require JavaScript. The agent instructions and setup guide
          remain available above.
        </p>
      </noscript>
    </section>
  );
}
