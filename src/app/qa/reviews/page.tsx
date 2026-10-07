import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { Suspense } from 'react';
import { ReviewQaExperience } from './ReviewQaExperience';
import '../../reporting.css';

export const metadata: Metadata = {
  title: 'Local review acceptance — AgentGrid',
  robots: { index: false, follow: false },
};
/** Deliberately separate local acceptance surface; never public inventory. */
export default function ReviewQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  return (
    <SiteFrame localPreview>
      <main id="main-content" className="resource-detail" data-agentgrid-qa="local-only">
        <p className="eyebrow">Disposable / local acceptance only</p>
        <h1>Local review acceptance fixture.</h1>
        <p>
          All feedback here is synthetic, memory-only test data. This is not a published agent, real
          creator, host verification or community activity. Nothing is written to Supabase or
          deployed.
        </p>
        <Suspense
          fallback={
            <section className="review-resource">
              <p role="status">Opening local acceptance surface…</p>
            </section>
          }
        >
          <ReviewQaExperience />
        </Suspense>
      </main>
    </SiteFrame>
  );
}
