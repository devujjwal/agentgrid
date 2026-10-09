import type { ReleaseApproval } from '../../domain/release-approval';
import { PublicationActions } from './PublicationActions';
import { ConfirmAction } from '../feedback/ConfirmAction';
export function ReleaseRequestList({
  approvals,
  publicationCsrf,
  busy,
  cancel,
}: {
  approvals: ReleaseApproval[];
  publicationCsrf?: string;
  busy: boolean;
  cancel: (id: string) => void;
}) {
  return (
    <section aria-labelledby="release-history-title">
      <h4 id="release-history-title">Recorded publication requests</h4>
      {!approvals.length && <p>No publication request has been recorded for this version.</p>}
      {approvals.map((row) => (
        <article className="moderation-review" key={row.requestId}>
          <p className="eyebrow">
            {row.state === 'requested' ? 'Awaiting publication checks' : row.state}{' '}
            {row.selfReview ? '· administrator self-review' : ''}
          </p>
          <p>
            Reference <span className="moderation-prose">{row.requestId}</span>
          </p>
          <p>
            {row.evidenceIds.length} selected observations · requested{' '}
            {row.requestedAt.slice(0, 10)} · expires {row.expiresAt.slice(0, 10)}
          </p>
          <p className="moderation-prose">{row.explanation}</p>
          {row.state === 'requested' && (
            <ConfirmAction
              label="Cancel publication request"
              title="Cancel this publication request?"
              description="This recorded review will remain in the private history. Cancellation prevents it from being used for publication."
              confirmation="Cancel request"
              disabled={busy}
              confirm={() => cancel(row.requestId)}
            />
          )}
          {publicationCsrf && (
            <PublicationActions
              key={row.requestId}
              approval={row}
              csrf={publicationCsrf}
              disabled={busy}
            />
          )}
          {row.state === 'released' && (
            <p>
              The live release was recorded. Static page publication is tracked separately; this
              receipt does not confirm a deployed page.
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
