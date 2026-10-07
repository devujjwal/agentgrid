import { DesignHome } from '../components/design/DesignHome';
import { localDesignCatalogue } from '../data/design-preview';

export default function HomePage() {
  const resources = localDesignCatalogue();
  if (resources.length) return <DesignHome resources={resources} />;
  return (
    <main>
      <h1>AgentGrid infrastructure verification</h1>
      <p>This test build validates static delivery. It is not the product experience.</p>
    </main>
  );
}
