import { z } from 'zod';
import { executionDigest } from './text-run.ts';

const checksum = z.string().regex(/^[a-f0-9]{64}$/);
export const PublicationPreviewSchema = z.strictObject({
  runId: z.uuid(),
  revision: z.int().positive(),
  // Private immutable object + checksum, not an arbitrary URL supplied to a publisher.
  mediaId: z.uuid(),
  mediaSha256: checksum,
  destinations: z
    .array(
      z.strictObject({
        platform: z.enum(['instagram', 'facebook', 'linkedin']),
        connectionId: z.uuid(),
        caption: z.string().trim().min(1).max(3000),
      }),
    )
    .min(1)
    .max(3)
    .refine(
      (destinations) =>
        new Set(destinations.map((d) => d.connectionId)).size === destinations.length,
      'Each destination must be distinct.',
    ),
  scheduledAt: z.iso.datetime(),
});

export interface PublishApproval {
  ownerId: string;
  digest: string;
  expiresAt: string;
}
export interface VerifiedConnection {
  id: string;
  ownerId: string;
  platform: 'instagram' | 'facebook' | 'linkedin';
  publishingEnabled: boolean;
}

/** Returns a stable server-side approval fingerprint. Changing any preview field
 * invalidates approval, including account, caption, media revision and UTC schedule.
 * HTTP must obtain this from the member's explicit approval action, never a model.
 */
export async function publicationPreviewDigest(preview: unknown): Promise<string> {
  return executionDigest(PublicationPreviewSchema.parse(preview));
}

export async function publicationIsAuthorized(options: {
  ownerId: string;
  preview: unknown;
  approval: PublishApproval | null;
  connections: VerifiedConnection[];
  now: Date;
}): Promise<boolean> {
  const parsed = PublicationPreviewSchema.safeParse(options.preview);
  const approval = options.approval;
  if (!parsed.success || !approval || !Number.isFinite(options.now.getTime())) return false;
  const expires = Date.parse(approval.expiresAt);
  if (
    approval.ownerId !== options.ownerId ||
    !Number.isFinite(expires) ||
    expires <= options.now.getTime() ||
    Date.parse(parsed.data.scheduledAt) > expires ||
    approval.digest !== (await publicationPreviewDigest(parsed.data))
  )
    return false;
  return parsed.data.destinations.every((destination) =>
    options.connections.some(
      (connection) =>
        connection.id === destination.connectionId &&
        connection.ownerId === options.ownerId &&
        connection.platform === destination.platform &&
        connection.publishingEnabled,
    ),
  );
}

/** The delivery worker calls this at dispatch time, after claiming its ledger row.
 * Preview approval can exist before a schedule is due; dispatch cannot.
 */
export async function publicationIsDue(
  options: Parameters<typeof publicationIsAuthorized>[0],
): Promise<boolean> {
  const preview = PublicationPreviewSchema.safeParse(options.preview);
  return (
    preview.success &&
    Date.parse(preview.data.scheduledAt) <= options.now.getTime() &&
    (await publicationIsAuthorized(options))
  );
}
