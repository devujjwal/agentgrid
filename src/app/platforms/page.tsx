import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'Platforms — AgentGrid connection guides',
  alternates: { canonical: '/platforms/' },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ConnectionIndex kind="platform" />;
}
