'use client';
import type { MediaOverview, PublicationSummary } from '../../domain/media-workspace';
import { ReelPlanner, type ReelDraft } from './ReelPlanner';
import { ConnectionControls } from './ConnectionControls';
import { ReelReviews } from './ReelReviews';
import { PublicationComposer } from './PublicationComposer';
import { PublicationReview } from './PublicationReview';
import { dollars } from '../execution/Runner';
export function MediaDashboard({
  overview,
  busy,
  onConnect,
  onChange,
  onPrepareReel,
  onPreparePublication,
}: {
  overview: MediaOverview;
  busy: boolean;
  onConnect: (platform: 'instagram' | 'facebook' | 'linkedin') => Promise<void>;
  onChange: (action: string, body: unknown) => Promise<void>;
  onPrepareReel: (draft: ReelDraft, sourceRunId: string) => Promise<void>;
  onPreparePublication: (body: unknown) => Promise<PublicationSummary | null>;
}) {
  return (
    <div className="media-workbench" aria-busy={busy}>
      <section>
        <h2>Your allowance</h2>
        <p>
          Remaining:{' '}
          {dollars(
            Math.max(
              0,
              overview.budget.limitMicros -
                overview.budget.spentMicros -
                overview.budget.heldMicros,
            ),
          )}{' '}
          · Reserved: {dollars(overview.budget.heldMicros)}
        </p>
        <p>
          Rendering requires both your allowance and the site allowance. You approve the maximum
          charge before any generation begins.
        </p>
        {!overview.capabilities.render && !overview.capabilities.publish && (
          <p className="media-notice" role="status">
            Execution is disabled. No generation or posting can start.
          </p>
        )}
      </section>
      <section aria-label="Storyboard planner">
        <h2>Plan a reel</h2>
        <ReelPlanner
          sources={overview.sources}
          enabled={overview.capabilities.render}
          busy={busy}
          onPrepare={onPrepareReel}
        />
      </section>
      <ReelReviews overview={overview} busy={busy} onChange={onChange} />
      <ConnectionControls
        overview={overview}
        busy={busy}
        onConnect={onConnect}
        onChange={onChange}
      />
      <PublicationComposer
        overview={overview}
        busy={busy}
        onPrepare={onPreparePublication}
        onChange={onChange}
      />
      <section aria-labelledby="publication-history">
        <h2 id="publication-history">Your publication history</h2>
        {!overview.publications.length ? (
          <p>No publications prepared yet.</p>
        ) : (
          overview.publications.map((publication) => (
            <PublicationReview
              key={publication.id}
              publication={publication}
              overview={overview}
              busy={busy}
              onChange={onChange}
            />
          ))
        )}
      </section>
    </div>
  );
}
