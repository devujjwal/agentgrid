import type { Metadata } from 'next';
import { ConnectionIndex } from '../../components/connections/ConnectionIndex';
export const metadata: Metadata = {
  title: 'Platforms — AgentGrid connection guides',
  description:
    'Compare how to bring agent instructions into ChatGPT, Claude and Gemini, including setup, permission boundaries and platform-specific limitations.',
  alternates: { canonical: '/platforms/' },
  robots: { index: false, follow: false },
};
export default function Page() {
  return <ConnectionIndex kind="platform" />;
}
