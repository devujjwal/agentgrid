import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { SignIn } from '../../components/identity/SignIn';
import { NetworkMark } from '../../components/brand/NetworkMark';
import '../identity.css';
export const metadata: Metadata = {
  title: 'Connect to AgentGrid',
  robots: { index: false, follow: false },
};
export default function SignInPage() {
  return (
    <SiteFrame localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}>
      <main id="main-content" className="identity-layout">
        <div className="identity-intro">
          <p className="eyebrow">AgentGrid / a place in the network</p>
          <h1>
            From discovery
            <br />
            to <em>your own orbit.</em>
          </h1>
          <NetworkMark />
          <p>One account for your saved agents, creator identity and work in progress.</p>
          <Link prefetch={false} href="/agents/">
            Keep exploring <span aria-hidden="true">↗</span>
          </Link>
        </div>
        <SignIn />
      </main>
    </SiteFrame>
  );
}
