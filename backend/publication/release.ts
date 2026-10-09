/** Offline trusted job. Never import into client components or accept caller-supplied observations. */
import { z } from 'zod';
import { contentChecksum } from '../../src/domain/content-checksum.ts';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ReleaseApprovalSchema } from '../../src/domain/release-approval.ts';
import { HostRunReceiptSchema } from '../../src/domain/host-verification.ts';
import { preparePublication, type PublicationInput } from './quality.ts';

const BundleSchema = z.strictObject({
  approval: ReleaseApprovalSchema,
  specification: z.unknown(),
  editorial: z.unknown(),
  observations: z.array(HostRunReceiptSchema).min(3).max(40),
});
export async function prepareReviewedRelease(
  bundle: unknown,
  now = new Date(),
  artifactResolver?: PublicationInput['artifactResolver'],
) {
  const source = BundleSchema.parse(bundle),
    review = source.approval;
  if (
    review.state !== 'requested' ||
    Date.parse(review.expiresAt) <= now.getTime() ||
    Date.parse(review.requestedAt) > now.getTime() ||
    review.evidenceIds.length !== source.observations.length ||
    source.observations.some(
      (record, index) =>
        record.id !== review.evidenceIds[index] ||
        record.versionId !== review.versionId ||
        record.contentDigest !== review.expectedDigest,
    )
  )
    throw new Error('Selected evidence or review is no longer eligible.');
  const prepared = await preparePublication(
    {
      specification: source.specification,
      editorial: source.editorial,
      databaseContentDigest: review.expectedDigest,
      hostRuns: source.observations.map((record) => record.run),
      ...(artifactResolver ? { artifactResolver } : {}),
    },
    now,
  );
  return { approval: review, ...prepared };
}
export async function executeReviewedRelease(
  client: SupabaseClient,
  requestId: string,
  now = new Date(),
  artifactResolver?: PublicationInput['artifactResolver'],
  expectedReviewFingerprint?: string,
) {
  z.uuid().parse(requestId);
  if (expectedReviewFingerprint !== undefined)
    z.string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(expectedReviewFingerprint);
  const read = await client.rpc('agentgrid_prepare_release_request', { request_id: requestId });
  if (read.error)
    throw new Error('Release preparation unavailable; inspect the private request status.');
  const prepared = await prepareReviewedRelease(read.data, now, artifactResolver);
  if (prepared.approval.requestId !== requestId)
    throw new Error('Release request identity mismatch.');
  if (
    expectedReviewFingerprint !== undefined &&
    (await reviewedReleaseFingerprint(prepared)) !== expectedReviewFingerprint
  )
    throw new Error('Prepared review changed. Run preparation again before publishing.');
  // A valid private artifact is not yet a usable public download. Keep the
  // release transaction closed until guarded workflow delivery is implemented.
  if (
    prepared.specification.execution.artifact_path ||
    prepared.specification.platforms.some((platform) => platform.distribution !== 'instructions')
  )
    throw new Error('Workflow artifact delivery is not ready for publication.');
  const write = await client.rpc('agentgrid_execute_release_request', {
    request_id: requestId,
    evidence: prepared.manifest,
  });
  if (write.error)
    throw new Error(
      'Release acknowledgement unavailable; read the recorded outcome before retrying.',
    );
  const receipt = ReleaseApprovalSchema.safeParse(write.data);
  if (
    !receipt.success ||
    receipt.data.requestId !== requestId ||
    receipt.data.versionId !== prepared.approval.versionId ||
    receipt.data.expectedDigest !== prepared.approval.expectedDigest ||
    receipt.data.state !== 'released' ||
    (await contentChecksum({
      ...receipt.data,
      state: prepared.approval.state,
      decidedAt: prepared.approval.decidedAt,
    })) !== (await contentChecksum(prepared.approval))
  )
    throw new Error(
      'Release acknowledgement is uncertain; read the recorded outcome before retrying.',
    );
  return { receipt: receipt.data, manifest: prepared.manifest };
}

export async function reviewedReleaseFingerprint(
  prepared: Awaited<ReturnType<typeof prepareReviewedRelease>>,
) {
  return contentChecksum({ approval: prepared.approval, manifest: prepared.manifest });
}

/** Explicit readback after a lost acknowledgement; a released receipt is historical, not proof of current public visibility. */
export async function inspectReviewedRelease(client: SupabaseClient, requestId: string) {
  z.uuid().parse(requestId);
  const result = await client.rpc('agentgrid_release_request_status', { request_id: requestId });
  if (result.error)
    throw new Error(
      'Release status is unavailable. Do not repeat a write until its outcome is known.',
    );
  if (result.data === null) return null;
  const receipt = ReleaseApprovalSchema.parse(result.data);
  if (receipt.requestId !== requestId) throw new Error('Release status identity mismatch.');
  return receipt;
}
