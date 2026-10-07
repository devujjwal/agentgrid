import type { Metadata } from 'next';
import { SiteFrame } from '../../../../components/layout/SiteFrame';
import { ReportModeration } from '../../../../components/moderation/ReportModeration';
import '../../../identity.css';
import '../../../moderation.css';
export const metadata: Metadata = {
  title: 'Report investigation — AgentGrid',
  robots: { index: false, follow: false },
};
export default function StaffReportsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout moderation-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Network stewardship / private concerns</p>
            <h1>
              Give every concern <em>a considered response.</em>
            </h1>
            <p className="moderation-intro">
              Investigate the reported content, complete any necessary resource changes, then record
              a clear outcome for the reporter.
            </p>
          </div>
        </header>
        <ReportModeration />
      </main>
    </SiteFrame>
  );
}
