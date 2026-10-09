/** Server-side publication orchestration. Credentials and observations never enter responses. */
import { z } from 'zod';
import type { PublicationClient } from './release.ts';
import type { ReleaseApproval } from '../../src/domain/release-approval.ts';
import {
  executeReviewedRelease,
  inspectReviewedRelease,
  prepareReviewedRelease,
  reviewedReleaseFingerprint,
} from './release.ts';
const summary = (receipt: ReleaseApproval | null) =>
  receipt === null
    ? { state: 'not-found' }
    : {
        requestId: receipt.requestId,
        resourceId: receipt.resourceId,
        versionId: receipt.versionId,
        state: receipt.state,
        expiresAt: receipt.expiresAt,
        decidedAt: receipt.decidedAt,
        selfReview: receipt.selfReview,
      };

export async function runReleaseAction(
  client: PublicationClient,
  plan: { action: string; requestId: string; fingerprint?: string },
  now = new Date(),
) {
  z.uuid().parse(plan.requestId);
  if (plan.action === 'inspect')
    return {
      ...summary(await inspectReviewedRelease(client, plan.requestId)),
      meaning: 'Historical request outcome; not proof of current visibility or site deployment.',
    };
  if (plan.action === 'prepare') {
    const read = await client.rpc('agentgrid_prepare_release_request', {
      request_id: plan.requestId,
    });
    if (read.error) throw new Error('Preparation unavailable.');
    const prepared = await prepareReviewedRelease(read.data, now);
    if (prepared.approval.requestId !== plan.requestId) throw new Error('Request mismatch.');
    if (
      prepared.specification.execution.artifact_path ||
      prepared.specification.platforms.some((platform) => platform.distribution !== 'instructions')
    )
      throw new Error('Artifact delivery unavailable.');
    return {
      ...summary(prepared.approval),
      slug: prepared.specification.identity.slug,
      packageVersion: prepared.specification.version,
      reviewFingerprint: await reviewedReleaseFingerprint(prepared),
      meaning: 'Quality preparation passed. No publication write or deployment performed.',
    };
  }
  if (plan.action !== 'publish') throw new Error('Unknown action.');
  z.string()
    .regex(/^[a-f0-9]{64}$/)
    .parse(plan.fingerprint);
  // No retry loop. A lost write acknowledgement must be resolved by inspect.
  const result = await executeReviewedRelease(
    client,
    plan.requestId,
    now,
    undefined,
    plan.fingerprint,
  );
  const confirmed = await inspectReviewedRelease(client, plan.requestId);
  if (
    !confirmed ||
    confirmed.state !== 'released' ||
    confirmed.versionId !== result.receipt.versionId ||
    confirmed.expectedDigest !== result.receipt.expectedDigest ||
    confirmed.decidedAt !== result.receipt.decidedAt
  )
    throw new Error('Release outcome uncertain.');
  return {
    ...summary(confirmed),
    reviewFingerprint: plan.fingerprint,
    meaning:
      'Database release confirmed. Capture, promotion and site deployment are separate steps.',
  };
}
