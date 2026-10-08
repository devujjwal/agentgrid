import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { CreatorReport } from '../../../components/reporting/CreatorReport';
import '../../identity.css';
import '../../reporting.css';
export const metadata: Metadata = {
  title: 'Report a creator concern — AgentGrid',
  robots: { index: false, follow: false },
};
export default function CreatorReportPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout reports-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Community care / private reporting</p>
            <h1>
              Keep the network <em>worth trusting.</em>
            </h1>
          </div>
        </header>
        <div className="report-introduction">
          <p>
            Describe your concern for the moderation team. Reports are private and do not change a
            profile automatically.
          </p>
        </div>
        <Suspense fallback={<p role="status">Loading reporting…</p>}>
          <CreatorReport />
        </Suspense>
      </main>
    </SiteFrame>
  );
}
