import { executionDigest } from './text-run.ts';

import { PublicationPreviewSchema } from '../../src/domain/media-workspace.ts';
export { PublicationPreviewSchema };

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
