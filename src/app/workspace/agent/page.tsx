import { Suspense } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { CreatorWorkspace } from '../../../components/authoring/CreatorWorkspace';
import '../../identity.css';
import './authoring.css';
export const metadata: Metadata = {
  title: 'Create an agent — AgentGrid',
  robots: { index: false, follow: false },
};
export default function CreatorPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout creator-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Your network / creator workspace</p>
            <h1>
              Build a signal <em>worth sharing.</em>
            </h1>
          </div>
          <Link prefetch={false} href="/workspace/" className="action-secondary">
            Your workspace <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <div className="creator-connection">
          <Suspense fallback={<p role="status">Connecting your workspace…</p>}>
            <CreatorWorkspace />
          </Suspense>
        </div>
      </main>
    </SiteFrame>
  );
}
