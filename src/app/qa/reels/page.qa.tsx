import { notFound } from 'next/navigation';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { MediaQa } from './MediaQa';
import { LocalReelEditor } from '../../../components/reels/local/LocalReelEditor';
import '../../identity.css';
import '../../workspace/runs/runs.css';
import '../../workspace/reels/reels.css';
export default function ReelsQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  return (
    <SiteFrame localPreview>
      <main id="main-content" tabIndex={-1} className="workspace-layout">
        <section className="identity-panel">
          <h1>Reels and publishing</h1>
          <p>Synthetic local interface test. No account, provider, charge or social post.</p>
          <LocalReelEditor />
          <MediaQa />
        </section>
      </main>
    </SiteFrame>
  );
}
