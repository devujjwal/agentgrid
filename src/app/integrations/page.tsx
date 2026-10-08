import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'Integrations — AgentGrid connection guides',
  alternates: { canonical: '/integrations/' },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ConnectionIndex kind="integration" />;
}
