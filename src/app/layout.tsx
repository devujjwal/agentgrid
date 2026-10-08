import { socialImage } from '../domain/social-metadata';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { CreatorMemoryProvider } from '../components/authoring/CreatorMemory';
import './globals.css';
import './actions.css';
import './resource.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://agentgrid.me'),
  title:
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'
      ? 'AgentGrid — Local design preview'
      : 'AgentGrid — The useful intelligence network',
  description:
    'Discover useful AI agents, understand their requirements and make informed choices about how to use them.',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
  openGraph: { type: 'website', siteName: 'AgentGrid', images: [socialImage] },
  twitter: { card: 'summary_large_image', images: [socialImage] },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <CreatorMemoryProvider>{children}</CreatorMemoryProvider>
      </body>
    </html>
  );
}
