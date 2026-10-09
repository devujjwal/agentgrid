import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteFrame } from '../../components/layout/SiteFrame';
import { DiscoveryConsole } from '../../components/discovery/DiscoveryConsole';
import { discoveryResources } from '../../data/resources';

export const metadata: Metadata = {
  title: 'Discover useful AI agents — AgentGrid',
  description:
    'Find AI agents by task. Compare the supplied instructions, required inputs, platform setup, reuse terms and limits before choosing a starting point.',
  alternates: { canonical: '/agents/' },
  robots: {
    index: process.env.AGENTGRID_BUILD_STAGE === 'production',
    follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
  },
};
export default function AgentsPage() {
  const resources = discoveryResources();
  const localPreview = process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1';
  return (
    <SiteFrame localPreview={localPreview}>
      <main id="main-content" className="agent-directory">
        <header className="directory-heading">
          <p className="eyebrow">The useful intelligence network</p>
          <h1>
            Find your next
            <br />
            <em>starting point.</em>
          </h1>
          <p>
            Explore agents by what you want to accomplish. Read the requirements, choose your
            platform and understand the limits before using a resource.
          </p>
          <Link className="directory-category-link" prefetch={false} href="/categories/">
            Not sure where to start? Explore category guides ↗
          </Link>
        </header>
        {resources.length ? (
          <DiscoveryConsole resources={resources} />
        ) : (
          <p>The reviewed library has not been published yet.</p>
        )}
      </main>
    </SiteFrame>
  );
}
