import type { Metadata } from 'next';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { Workspace } from '../../components/workspace/Workspace';
import '../identity.css';
export const metadata: Metadata = {
  title: 'Your workspace — AgentGrid',
  robots: { index: false, follow: false },
};
export default function WorkspacePage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout">
        <Workspace />
      </main>
    </SiteFrame>
  );
}
