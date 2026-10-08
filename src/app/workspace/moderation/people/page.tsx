import type { Metadata } from 'next';
import { SiteFrame } from '../../../../components/layout/SiteFrame';
import { ProfileAdministration } from '../../../../components/moderation/ProfileAdministration';
import '../../../identity.css';
import '../../../moderation.css';
export const metadata: Metadata = {
  title: 'Profiles and staff — AgentGrid',
  robots: { index: false, follow: false },
};
export default function PeoplePage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout moderation-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Network stewardship / administrator access</p>
            <h1>
              Keep trust <em>in human hands.</em>
            </h1>
            <p className="moderation-intro">
              Review an exact profile. Control AgentGrid access. Record why each decision was made.
            </p>
          </div>
        </header>
        <ProfileAdministration />
      </main>
    </SiteFrame>
  );
}
