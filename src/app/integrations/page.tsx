import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'Integrations — AgentGrid connection guides',
  description:
    'Prepare useful inputs from GitHub and Google Search Console. Understand the difference between a manual handoff, a connector and permission to act.',
  alternates: { canonical: '/integrations/' },
  robots: {
    index: false,
    follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
  },
};
export default function Page() {
  return <ConnectionIndex kind="integration" />;
}
