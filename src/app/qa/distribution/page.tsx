import { readFileSync } from 'node:fs';
import { notFound } from 'next/navigation';
import { parseAgentSpecification } from '../../../domain/agent-specification';
import { ResourceSetup } from '../../../components/resource/ResourceSetup';
import { SaveAgent } from '../../../components/resource/SaveAgent';
import { AuthoringQa } from '../../../components/authoring/AuthoringQa';
import { ReportResource } from '../../../components/reporting/ReportResource';
import '../../reporting.css';
import '../../identity.css';
import '../../workspace/agent/authoring.css';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import type { PublicResource } from '../../../domain/public-resource';

/** Local component acceptance fixture, never a public release or host run.
 * Normal exports prune its generated not-found artifact before delivery.
 */
export default function DistributionQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  const specification = parseAgentSpecification(
    JSON.parse(readFileSync('tests/fixtures/clipboard.agent.json', 'utf8')),
  );
  // Only setup consumes this synthetic transport fixture. It does not enter the
  // public catalogue/parser, SEO schema, database, moderation or publication path.
  const fixture: PublicResource = {
    resource_id: '00000000-0000-4000-8000-000000000001',
    version_id: '00000000-0000-4000-8000-000000000002',
    specification,
    released_at: '2026-10-07T00:00:00Z',
    creator: { name: 'Synthetic local QA fixture', kind: 'community', username: null },
    lineage: [],
    editorial: {
      overview: 'Synthetic component acceptance fixture only.',
      audience: [],
      workflow: [],
      faq: [],
      sources: [],
      related_agent_slugs: [],
      reviewed_on: '2026-10-07',
    },
  };
  return (
    <SiteFrame localPreview>
      <main id="main-content" className="resource-detail" data-agentgrid-qa="local-only">
        <h1>Local distribution acceptance fixture</h1>
        <p>
          This synthetic component fixture tests clipboard and definition-download behavior. It is
          not a published agent, real creator, host verification or community activity. Nothing is
          written to Supabase or deployed.
        </p>
        <div className="resource-action-row">
          <SaveAgent resourceId={fixture.resource_id} slug="article-structure-editor" />
        </div>
        <ResourceSetup specification={specification} publication={fixture} />
        <AuthoringQa />
        <ReportResource
          targetKind="agent"
          targetId={fixture.resource_id}
          label="Synthetic report acceptance fixture"
          path="/qa/distribution/"
        />
      </main>
    </SiteFrame>
  );
}
