import { DesignHome } from '../components/design/DesignHome';
import { discoveryResources } from '../data/resources';

export default function HomePage() {
  const resources = discoveryResources();
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
