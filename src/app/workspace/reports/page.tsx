import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { OwnedReports } from '../../../components/reporting/OwnedReports';
import '../../identity.css';
import '../../reporting.css';
export const metadata: Metadata = {
  title: 'Your private reports — AgentGrid',
  robots: { index: false, follow: false },
};
export default function ReportsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout reports-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Your network / private reporting</p>
            <h1>
              Keep the network <em>trustworthy.</em>
            </h1>
          </div>
          <Link prefetch={false} href="/workspace/" className="action-secondary">
            Your workspace <span aria-hidden="true">↗</span>
          </Link>
        </header>
        <section className="report-introduction" aria-labelledby="report-introduction-title">
          <h2 id="report-introduction-title">A concern deserves a clear response.</h2>
          <p>
            Your reports help AgentGrid staff investigate safety, privacy, reuse rights and broken
            resources. Details stay private to you and authorized staff. The status below comes from
            live moderation data.
          </p>
        </section>
        <div className="report-connection">
          <OwnedReports />
        </div>
      </main>
    </SiteFrame>
  );
}
