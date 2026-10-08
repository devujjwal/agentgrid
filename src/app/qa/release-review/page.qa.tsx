import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { SiteFrame } from '../../../components/layout/SiteFrame';
import { ReleaseReviewQa } from './ReleaseReviewQa';
import '../../identity.css';
import '../../moderation.css';
export const metadata: Metadata = {
  title: 'Local publication review acceptance — AgentGrid',
  robots: { index: false, follow: false },
};
export default function ReleaseReviewQaPage() {
  if (
    process.env.AGENTGRID_LOCAL_DESIGN_PREVIEW !== '1' ||
    process.env.CI ||
    process.env.GITHUB_ACTIONS
  )
    notFound();
  return (
    <SiteFrame localPreview>
      <main
        id="main-content"
        className="workspace-layout moderation-layout"
        data-agentgrid-qa="local-only"
      >
        <h1>Local publication review acceptance.</h1>
        <p>
          Disposable presentation fixture only. No real host was tested; nothing is recorded in a
          database or published.
        </p>
        <h2>Private publication review</h2>
        <ReleaseReviewQa />
      </main>
    </SiteFrame>
  );
}
