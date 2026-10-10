import { notFound } from 'next/navigation';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ExecutionQa } from './ExecutionQa';
import '../../identity.css';
import '../../workspace/runs/runs.css';
export default function ExecutionQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  return (
    <SiteFrame localPreview>
      <main id="main-content" className="workspace-layout">
        <section className="identity-panel">
          <h1>Run an agent</h1>
          <p>
            Synthetic local acceptance fixture. No real provider call, database record or charge.
          </p>
          <ExecutionQa />
        </section>
      </main>
    </SiteFrame>
  );
}
