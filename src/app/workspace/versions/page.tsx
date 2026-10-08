import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { CreatorVersions } from '../../../components/authoring/CreatorVersions';
import '../../identity.css';
import '../agent/authoring.css';
import './versions.css';
export const metadata: Metadata = {
  title: 'Your agent versions — AgentGrid',
  robots: { index: false, follow: false },
};
export default function CreatorVersionsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout creator-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Your network / creator workspace</p>
            <h1>
              Keep the <em>lineage clear.</em>
            </h1>
          </div>
          <Link prefetch={false} href="/workspace/" className="action-secondary">
            Your workspace <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <section className="version-introduction" aria-labelledby="version-introduction-title">
          <p className="eyebrow">Definition + guide → immutable snapshot → review</p>
          <h2 id="version-introduction-title">From draft to a lasting version.</h2>
          <p>
            Submitting freezes the saved definition and guide and requests review. You can keep
            editing your draft; the submitted content and version number cannot be overwritten.
            Submission does not publish it.
          </p>
        </section>
        <div className="version-connection">
          <Suspense fallback={<p role="status">Connecting your version history…</p>}>
            <CreatorVersions />
          </Suspense>
        </div>
      </main>
    </SiteFrame>
  );
}
