import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'MCP — AgentGrid connection guides',
  description:
    'Understand Model Context Protocol before connecting an agent to tools: review server trust, data access, tool permissions and human approval boundaries.',
  alternates: { canonical: '/mcp/' },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ConnectionIndex kind="mcp" />;
}
