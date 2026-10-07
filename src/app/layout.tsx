import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  metadataBase: new URL('https://agentgrid.me'),
  title: 'AgentGrid — Infrastructure verification',
  description: 'Private infrastructure validation build for AgentGrid.me.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
