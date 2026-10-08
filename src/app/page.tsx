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
  alternates: { canonical: '/' },
  robots: { index: false, follow: false },
};

export default async function HomePage() {
  const resources = [
    ...discoveryResources(),
    ...(await recipeDiscovery()),
    ...categoryDiscovery(categoryGuides),
  ];
  return (
    <DesignHome
      resources={resources}
      localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}
    />
  );
}
