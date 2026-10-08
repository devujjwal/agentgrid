'use client';
import type { HostRunSummary } from '../../domain/host-verification';
import { RequestReleaseSchema, type RequestRelease } from '../../domain/release-approval';
import { ConfirmAction } from '../feedback/ConfirmAction';
const checks = [
  ['standaloneValue', 'The page solves a distinct task and provides useful setup guidance.'],
  ['sourceAccuracy', 'I checked factual claims and the cited sources.'],
  [
    'platformEvidence',
    'I inspected the selected real host observations for every declared platform.',
  ],
  [
    'privacyAndSecurity',
    'I reviewed permissions, privacy, prompt injection and unsafe output risks.',
  ],
  ['distributionAndCosts', 'The use steps, limitations and any host costs are clear and accurate.'],
  ['reuseRights', 'The creator has supplied explicit, appropriate reuse rights.'],
] as const;
export interface ReleaseReviewDraft {
  requestId: string;
  evidenceIds: string[];
  explanation: string;
  checks: Record<(typeof checks)[number][0], boolean>;
}
export function emptyReleaseReview(): ReleaseReviewDraft {
  return {
    requestId: '',
    evidenceIds: [],
    explanation: '',
    checks: {
      standaloneValue: false,
      sourceAccuracy: false,
      platformEvidence: false,
      privacyAndSecurity: false,
      distributionAndCosts: false,
      reuseRights: false,
    },
  };
}
export function ReleaseReviewForm({
  value,
  change,
  runs,
  binding,
  disabled,
  selfReview,
  submit,
}: {
  value: ReleaseReviewDraft;
  change: (value: ReleaseReviewDraft) => void;
  runs: HostRunSummary[];
  binding: Pick<
    RequestRelease,
    'versionId' | 'expectedDigest' | 'expectedResourceRevision' | 'expectedReleaseId'
  >;
  disabled: boolean;
  selfReview: boolean;
  submit: (value: RequestRelease) => void;
}) {
  const parsed = RequestReleaseSchema.safeParse({ ...value, ...binding });
  const edit = (next: ReleaseReviewDraft) => change({ ...next, requestId: crypto.randomUUID() });
  return (
    <form className="moderation-decision" onSubmit={(event) => event.preventDefault()}>
      <fieldset className="moderation-fields release-review-fields" disabled={disabled}>
        <legend>Evidence for this release</legend>
        <p>
          Select one passing observation per platform and scenario: normal, ambiguous input and
          adversarial input. Inspect the full observations in Host verification evidence before
          selecting them.
        </p>
        {!runs.length && <p>No observations recorded for this version yet.</p>}
        {runs.map((run) => (
          <label className="moderation-choice" key={run.id}>
            <input
              type="checkbox"
              disabled={run.failedChecks > 0}
              checked={value.evidenceIds.includes(run.id)}
              onChange={(event) =>
                edit({
                  ...value,
                  checks: { ...value.checks, platformEvidence: false },
                  evidenceIds: event.target.checked
                    ? [...value.evidenceIds, run.id]
                    : value.evidenceIds.filter((id) => id !== run.id),
                })
              }
            />
            <span>
              {run.platform} · {run.scenario} · {run.completedOn}
              <br />
              <small>
                Reference {run.id.slice(0, 8)} ·{' '}
                {run.failedChecks
                  ? `${run.failedChecks} failed checks — cannot select`
                  : 'No failed assertions recorded'}
              </small>
            </span>
          </label>
        ))}
      </fieldset>
      <fieldset className="moderation-fields release-review-fields" disabled={disabled}>
        <legend>Staff review</legend>
        <p>These confirmations record your own review. Author declarations do not fill them in.</p>
        {checks.map(([key, label]) => (
          <label className="moderation-choice" key={key}>
            <input
              type="checkbox"
              checked={value.checks[key]}
              onChange={(event) =>
                edit({ ...value, checks: { ...value.checks, [key]: event.target.checked } })
              }
            />
            <span>{label}</span>
          </label>
        ))}
        <label htmlFor="release-explanation">Review rationale</label>
        <p id="release-explanation-help">
          80–2,400 characters. Explain the value, evidence and any remaining limitations. Keep
          credentials and personal test data out.
        </p>
        <textarea
          id="release-explanation"
          aria-describedby="release-explanation-help"
          value={value.explanation}
          minLength={80}
          maxLength={2400}
          rows={6}
          onChange={(event) => edit({ ...value, explanation: event.target.value })}
        />
        {selfReview && (
          <p className="moderation-notice">
            This is your own submission. Only an administrator can record this review; it will be
            explicitly retained as a self-review.
          </p>
        )}
        <p>
          The request expires after seven days. Changes to agent access, its released version or
          reviewer authority prevent publication. All quality checks must still pass.
        </p>
        {!parsed.success && (
          <p>
            Select at least three distinct observations, complete all six confirmations and provide
            a review rationale.
          </p>
        )}
        <ConfirmAction
          label="Request publication"
          title="Record this publication review?"
          description="Your selected evidence and review will be retained against this exact version. This does not immediately publish the page. The trusted publication process rechecks quality and eligibility. You can cancel an unprocessed request."
          confirmation="Record publication request"
          disabled={disabled || !parsed.success}
          confirm={() => {
            if (parsed.success) submit(parsed.data);
          }}
        />
      </fieldset>
    </form>
  );
}
