import type { Metadata } from 'next';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { SavedAgents } from '../../components/workspace/SavedAgents';
import '../identity.css';
import './saves.css';

export const metadata: Metadata = {
  title: 'Your saved agents — AgentGrid',
  robots: { index: false, follow: false },
};
export default function SavedAgentsPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout">
        <SavedAgents />
      </main>
    </SiteFrame>
  );
}
