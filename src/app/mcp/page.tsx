import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'Mcp — AgentGrid connection guides',
  alternates: { canonical: '/mcp/' },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ConnectionIndex kind="mcp" />;
}
