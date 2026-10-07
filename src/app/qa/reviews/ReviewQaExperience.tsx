'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ReviewResource } from '../../../components/reviews/ReviewResource';
import { ReviewEditor } from '../../../components/reviews/ReviewEditor';

/** Reproducible local reader/editor audit entry; the enclosing route is pruned
 * from every production export. This grants no identity or database authority. */
export function ReviewQaExperience() {
  const editor = useSearchParams().get('panel') === 'editor';
  return (
    <>
      <nav aria-label="Local review acceptance surfaces">
        <Link prefetch={false} href="/qa/reviews/" aria-current={!editor ? 'page' : undefined}>
          Reader acceptance
        </Link>
        {' · '}
        <Link
          prefetch={false}
          href="/qa/reviews/?panel=editor"
          aria-current={editor ? 'page' : undefined}
        >
          Editor acceptance
        </Link>
        {' · '}
        <Link prefetch={false} href="/workspace/">
          Workspace acceptance
        </Link>
      </nav>
      {editor ? (
        <section className="review-resource" aria-label="Local review editor">
          <h2>Private review editor.</h2>
          <ReviewEditor
            resourceId="00000000-0000-4000-8000-000000000001"
            label="Synthetic review acceptance fixture"
            path="/qa/reviews/?panel=editor"
            changed={() => {}}
          />
        </section>
      ) : (
        <ReviewResource
          resourceId="00000000-0000-4000-8000-000000000001"
          label="Synthetic review acceptance fixture"
          path="/qa/reviews/"
        />
      )}
    </>
  );
}
