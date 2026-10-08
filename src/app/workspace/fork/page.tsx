import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ForkWorkspace } from '../../../components/forks/ForkWorkspace';
import '../../identity.css';
import './fork.css';
export const metadata: Metadata = {
  title: 'Fork an agent — AgentGrid',
  robots: { index: false, follow: false },
};
export default function ForkPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout fork-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Your network / a new branch</p>
            <h1>
              Start with a signal.
              <br />
              <em>Give it your direction.</em>
            </h1>
            <p>A fork keeps its source connected while you develop a version of your own.</p>
          </div>
        </header>
        <Suspense fallback={<p role="status">Connecting your workspace…</p>}>
          <ForkWorkspace />
        </Suspense>
      </main>
    </SiteFrame>
  );
}
