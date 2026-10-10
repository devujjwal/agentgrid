import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { Runner } from '../../../components/execution/Runner';
import '../../identity.css';
import './runs.css';
export const metadata: Metadata = {
  title: 'Run an agent — AgentGrid',
  robots: { index: false, follow: false },
};
export default function RunsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" tabIndex={-1} className="workspace-layout">
        <Runner />
      </main>
    </SiteFrame>
  );
}
