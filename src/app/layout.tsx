import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import './resource.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://agentgrid.me'),
  title:
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'
      ? 'AgentGrid — Local design preview'
      : 'AgentGrid — Infrastructure verification',
  description: 'Private infrastructure validation build for AgentGrid.me.',
  robots: { index: false, follow: false },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
