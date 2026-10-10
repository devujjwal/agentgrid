'use client';
import { useState } from 'react';
import type { MediaOverview, ReelSummary } from '../../domain/media-workspace';
import { dollars } from '../execution/Runner';
export function ReelReviews({
  overview,
  busy,
  onChange,
}: {
  overview: MediaOverview;
  busy: boolean;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  return (
    <section aria-labelledby="saved-reels-title">
      <h2 id="saved-reels-title">Your saved reels</h2>
      {!overview.reels.length ? (
        <p>
          No saved reels yet. Preview a storyboard above; saving and rendering will open after
          execution is enabled.
        </p>
      ) : (
        overview.reels.map((reel) => (
          <ReelReview
            key={reel.id}
            reel={reel}
            overview={overview}
            busy={busy}
            onChange={onChange}
          />
        ))
      )}
    </section>
  );
}
function ReelReview({
  reel,
  overview,
  busy,
  onChange,
}: {
  reel: ReelSummary;
  overview: MediaOverview;
  busy: boolean;
  onChange: (action: string, body: unknown) => Promise<void>;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const allowance = Math.min(
    overview.budget.limitMicros - overview.budget.heldMicros - overview.budget.spentMicros,
    overview.siteBudget.limitMicros -
      overview.siteBudget.heldMicros -
      overview.siteBudget.spentMicros,
  );
  return (
    <article className="run-card">
      <h3>{reel.plan.title}</h3>
      <p>
        Status: {reel.state} · Maximum charge: {dollars(reel.maximumCostMicros)}
      </p>
      <details>
        <summary>Review narration and storyboard</summary>
        <p className="reel-script">{reel.plan.narration}</p>
        <ol>
          {reel.plan.scenes.map((scene, i) => (
            <li key={i}>
              <strong>{scene.seconds} seconds</strong>
              <p>{scene.visual}</p>
              <p>On-screen: {scene.onScreenText || 'None'}</p>
            </li>
          ))}
        </ol>
      </details>
      {reel.state === 'queued' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onChange('approve-reel', {
              id: reel.id,
              digest: reel.digest,
              confirmed: true,
            }).then(() => setConfirmed(false));
          }}
        >
          <label className="media-check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={busy || !overview.capabilities.render}
            />
            Approve this storyboard and a charge up to {dollars(reel.maximumCostMicros)}.
          </label>
          {allowance < reel.maximumCostMicros && (
            <p>There is not enough allowance for this render.</p>
          )}
          <button
            className="action-primary"
            disabled={
              busy ||
              !confirmed ||
              !overview.capabilities.render ||
              allowance < reel.maximumCostMicros
            }
          >
            Approve and render
          </button>
        </form>
      )}
      {reel.state === 'ready' && reel.asset && (
        <>
          <video
            className="reel-video"
            controls
            preload="none"
            src={`/api/media/video/?id=${reel.id}`}
            aria-label={`Finished video: ${reel.plan.title}`}
          />
          <p>Review the finished video before preparing a post. Rendering does not publish it.</p>
        </>
      )}
      <div className="reel-actions">
        {reel.state === 'rendering' && (
          <button
            type="button"
            className="action-secondary"
            disabled={busy || !overview.capabilities.render}
            onClick={() =>
              void onChange('inspect', { id: reel.id, digest: reel.digest, confirmed: true })
            }
          >
            Check render status
          </button>
        )}
        {['queued', 'rendering'].includes(reel.state) && (
          <button
            type="button"
            className="action-secondary"
            disabled={busy}
            onClick={() => void onChange('cancel-reel', { id: reel.id })}
          >
            Cancel render
          </button>
        )}
      </div>
      {reel.state === 'uncertain' && (
        <p>
          The provider outcome needs reconciliation. A second render will not be started
          automatically.
        </p>
      )}
    </article>
  );
}
