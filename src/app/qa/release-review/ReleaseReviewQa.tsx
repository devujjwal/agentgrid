'use client';
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
  const [value, change] = useState(emptyReleaseReview),
    [message, setMessage] = useState('');
  return (
    <>
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
    </>
  );
}
