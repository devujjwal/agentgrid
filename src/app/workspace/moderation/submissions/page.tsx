import type { Metadata } from 'next';
import { SiteFrame } from '../../../../components/layout/SiteFrame';
import { SubmissionModeration } from '../../../../components/moderation/SubmissionModeration';
import '../../../identity.css';
import '../../../moderation.css';
export const metadata: Metadata = {
  title: 'Submission review — AgentGrid',
  robots: { index: false, follow: false },
};
export default function StaffSubmissionsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout moderation-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Network stewardship / immutable submissions</p>
            <h1>
              Make every release <em>earn its place.</em>
            </h1>
            <p className="moderation-intro">
              Read the submitted definition and public guide. Give creators specific feedback on
              what needs to change before their agent can reach the network.
            </p>
          </div>
        </header>
        <SubmissionModeration />
      </main>
    </SiteFrame>
  );
}
