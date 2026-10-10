import { serializeStructuredData } from '../domain/public-resource';
import { socialImage } from '../domain/social-metadata';
import { connectionGuides } from '../data/connections';
import { integrationDiscovery } from '../domain/connection-guide';
import type { Metadata } from 'next';
import { categoryGuides } from '../data/categories';
import { categoryDiscovery } from '../domain/category';
import { DesignHome } from '../components/design/DesignHome';
import { recipeDiscovery } from '../data/recipes';
import { discoveryResources } from '../data/resources';

export const metadata: Metadata = {
  title: 'AgentGrid — Find useful AI agents for your world',
  description:
    'Explore AI agents, guided recipes and practical category guides. Understand the inputs, setup and limits before bringing an agent into your work.',
  openGraph: { images: [socialImage], type: 'website', url: '/' },
  alternates: { canonical: '/' },
  verification: { other: { 'msvalidate.01': '73BE7F84DA4E3D58B6163DB3152475A7' } },
  robots: {
    index: process.env.AGENTGRID_BUILD_STAGE === 'production',
    follow: process.env.AGENTGRID_BUILD_STAGE === 'production',
  },
};

export default async function HomePage() {
  const resources = [
    ...discoveryResources(),
    ...(await recipeDiscovery()),
    ...categoryDiscovery(categoryGuides),
    ...integrationDiscovery(connectionGuides),
  ];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeStructuredData({
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Organization',
                '@id': 'https://agentgrid.me/#organization',
                name: 'AgentGrid',
                url: 'https://agentgrid.me/',
              },
              {
                '@type': 'WebSite',
                '@id': 'https://agentgrid.me/#website',
                name: 'AgentGrid',
                url: 'https://agentgrid.me/',
                inLanguage: 'en',
                publisher: { '@id': 'https://agentgrid.me/#organization' },
              },
            ],
          }),
        }}
      />
      <DesignHome
        resources={resources}
        localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}
      />
    </>
  );
}
