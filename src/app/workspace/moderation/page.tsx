import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ReviewModeration } from '../../../components/moderation/ReviewModeration';
import '../../identity.css';
import '../../moderation.css';
export const metadata: Metadata = {
  title: 'Review moderation — AgentGrid',
  robots: { index: false, follow: false },
};
export default function ModerationPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout moderation-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Network stewardship / staff access</p>
            <h1>
              Keep every signal <em>accountable.</em>
            </h1>
            <p className="moderation-intro">
              Read the experience. Check the context. Make a clear, recorded decision.
            </p>
          </div>
        </header>
        <ReviewModeration />
      </main>
    </SiteFrame>
  );
}
