import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ReelWorkspace } from '../../../components/reels/ReelWorkspace';
import '../../identity.css';
import '../runs/runs.css';
import './reels.css';
export const metadata: Metadata = {
  title: 'Plan a reel — AgentGrid',
  robots: { index: false, follow: false },
};
export default function ReelsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="workspace-layout">
        <ReelWorkspace />
      </main>
    </SiteFrame>
  );
}
