import { notFound } from 'next/navigation';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ReelPlanner } from '../../../components/reels/ReelPlanner';
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
          <h1>Plan a reel</h1>
          <p>Synthetic local interface test. No account, provider, charge or social post.</p>
          <ReelPlanner
            initial={{
              title: 'A little garden, a fresh start',
              narration:
                'A small pot, a handful of soil, and five minutes. Start your first kitchen garden today.',
              scenes: [
                {
                  seconds: 5,
                  visual: 'Close-up of soil being added to a small terracotta pot.',
                  onScreenText: 'Start small.',
                },
                {
                  seconds: 5,
                  visual: 'A seedling placed gently in the soil beside a bright window.',
                  onScreenText: 'Give it light.',
                },
                {
                  seconds: 5,
                  visual: 'The finished herb pot on a kitchen windowsill.',
                  onScreenText: 'Grow something today.',
                },
              ],
              format: 'portrait-720p',
            }}
          />
        </section>
      </main>
    </SiteFrame>
  );
}
