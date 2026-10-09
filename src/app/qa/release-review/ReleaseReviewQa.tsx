'use client';
import Link from 'next/link';
import { PublicationActions } from '../../../components/moderation/PublicationActions';
import { useIdentity } from '../../../components/identity/useIdentity';
import { useModerationAccess } from '../../../components/moderation/useModerationAccess';
import { useState } from 'react';
import {
  emptyReleaseReview,
  ReleaseReviewForm,
} from '../../../components/moderation/ReleaseReviewForm';
import type { HostRunSummary } from '../../../domain/host-verification';
const versionId = '30000000-0000-4000-8000-000000000001';
const runs: HostRunSummary[] = (['normal', 'ambiguous-input', 'adversarial-input'] as const).map(
  (scenario, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`,
    versionId,
    contentDigest: 'a'.repeat(64),
    recordedAt: '2026-10-08T00:00:00Z',
    platform: 'chatgpt',
    scenario,
    completedOn: '2026-10-08',
    failedChecks: 0,
  }),
);
export function ReleaseReviewQa() {
  const identity = useIdentity(),
    access = useModerationAccess(identity.identity);

  const [value, change] = useState(emptyReleaseReview),
    [message, setMessage] = useState('');
  return (
    <div data-agentgrid-qa-client="local-only">
      <h3>Server publication acceptance</h3>
      <p>
        Only the disposable local server handles these operations. No provider or real publication
        is involved.
      </p>
      {identity.identity?.signedIn && access.administrator ? (
        <PublicationActions
          approval={{
            requestId: '50000000-0000-4000-8000-000000000001',
            versionId,
            resourceId: '20000000-0000-4000-8000-000000000001',
            expectedDigest: 'a'.repeat(64),
            expectedResourceRevision: 0,
            expectedReleaseId: null,
            evidenceIds: runs.map((r) => r.id),
            checks: {
              standaloneValue: true,
              sourceAccuracy: true,
              platformEvidence: true,
              privacyAndSecurity: true,
              distributionAndCosts: true,
              reuseRights: true,
            },
            explanation:
              'Synthetic publication UI acceptance only. No real evidence is asserted and no public content is created.',
            selfReview: false,
            requestedAt: '2026-10-08T00:00:00Z',
            expiresAt: '2026-10-15T00:00:00Z',
            state: 'requested',
            decidedAt: null,
          }}
          csrf={identity.identity.csrf}
          disabled={false}
        />
      ) : (
        <p>
          Sign in locally and appoint the disposable administrator to exercise publication.{' '}
          <Link href="/sign-in/?returnTo=%2Fqa%2Frelease-review%2F">Local sign in</Link>
        </p>
      )}
      <button className="action-secondary" onClick={identity.reload}>
        Recheck local publication access
      </button>
      {message && <p role="status">{message}</p>}
      <ReleaseReviewForm
        value={value}
        change={change}
        runs={runs}
        binding={{
          versionId,
          expectedDigest: 'a'.repeat(64),
          expectedResourceRevision: 0,
          expectedReleaseId: null,
        }}
        disabled={false}
        selfReview={false}
        submit={() =>
          setMessage('Synthetic local presentation only. No publication request was stored.')
        }
      />
    </div>
  );
}
