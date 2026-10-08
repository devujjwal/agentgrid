import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { AccountControls } from '../../../components/workspace/AccountControls';
import '../../identity.css';
import './account.css';
export const metadata: Metadata = {
  title: 'Account controls — AgentGrid',
  robots: { index: false, follow: false },
};
export default function AccountPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="workspace-layout">
        <header className="workspace-heading">
          <div>
            <p className="eyebrow">Your network / account controls</p>
            <h1>
              Your place.
              <br />
              <em>Your choice.</em>
            </h1>
          </div>
          <Link prefetch={false} href="/workspace/" className="action-secondary">
            Return to workspace ↗
          </Link>
        </header>
        <AccountControls />
      </main>
    </SiteFrame>
  );
}
