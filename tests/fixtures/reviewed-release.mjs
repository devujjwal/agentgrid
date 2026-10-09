import { publicationFixture } from './publication.mjs';
const versionId = '30000000-0000-4000-8000-000000000001',
  requestId = '50000000-0000-4000-8000-000000000001';
const now = new Date('2026-10-08T00:00:00Z');
export async function reviewedReleaseFixture() {
  const source = await publicationFixture();
  const observations = source.hostRuns.map((run, index) => ({
    id: `40000000-0000-4000-8000-00000000000${index + 1}`,
    versionId,
    contentDigest: source.databaseContentDigest,
    recordedAt: now.toISOString(),
    run,
  }));
  const input = {
    requestId,
    versionId,
    expectedDigest: source.databaseContentDigest,
    expectedResourceRevision: 0,
    expectedReleaseId: null,
    evidenceIds: observations.map((r) => r.id),
    checks: {
      standaloneValue: true,
      sourceAccuracy: true,
      platformEvidence: true,
      privacyAndSecurity: true,
      distributionAndCosts: true,
      reuseRights: true,
    },
    explanation:
      'Synthetic staff decision used to test the authority boundary. No actual host test or public editorial approval is claimed.',
  };
  const approval = {
    ...input,
    resourceId: '20000000-0000-4000-8000-000000000001',
    selfReview: false,
    requestedAt: now.toISOString(),
    expiresAt: '2026-10-15T00:00:00Z',
    state: 'requested',
    decidedAt: null,
  };
  return {
    input,
    approval,
    bundle: {
      approval,
      specification: source.specification,
      editorial: source.editorial,
      observations,
    },
  };
}
