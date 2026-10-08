import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../../components/layout/SiteFrame';
import { ResourceModeration } from '../../../../components/moderation/ResourceModeration';
import '../../../identity.css';
import '../../../moderation.css';
export const metadata: Metadata = {
  title: 'Agent access — AgentGrid',
  robots: { index: false, follow: false },
};
export default function AgentModerationPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout moderation-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Network stewardship / agent access</p>
            <h1>
              Keep the network <em>worthy of trust.</em>
            </h1>
            <p className="moderation-intro">
              Investigate the resource, record your reasoning and control its live access. Every
              decision stays tied to the state you reviewed.
            </p>
          </div>
        </header>
        <Suspense fallback={<p role="status">Connecting the moderation workspace…</p>}>
          <ResourceModeration />
        </Suspense>
      </main>
    </SiteFrame>
  );
}
