import { DesignHome } from '../components/design/DesignHome';
import { recipeDiscovery } from '../data/recipes';
import { discoveryResources } from '../data/resources';

export default async function HomePage() {
  const resources = [...discoveryResources(), ...(await recipeDiscovery())];
  if (resources.length)
    return (
      <DesignHome
        resources={resources}
        localPreview={process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW === '1'}
      />
    );
  return (
    <main>
      <h1>AgentGrid infrastructure verification</h1>
      <p>This test build validates static delivery. It is not the product experience.</p>
    </main>
  );
}
