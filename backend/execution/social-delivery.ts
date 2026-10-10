import { ExecutionError, type RuntimeActor } from './contracts.ts';
import { publicationIsDue, publicationPreviewDigest } from './publication-approval.ts';
import { MediaAssetSchema, type DeliveryStore, type SocialPublisher } from './reel-contracts.ts';

export async function deliverPublication(options: {
  enabled: boolean;
  actor: RuntimeActor;
  deliveryId: string;
  store: DeliveryStore;
  publisher: SocialPublisher;
  now: Date;
  resumeUpload?: boolean;
}): Promise<void> {
  if (!options.enabled) throw new ExecutionError('disabled');
  if (!options.actor.active) throw new ExecutionError('membership_required');
  const record = await options.store.read(options.actor.profileId, options.deliveryId);
  if (!record || record.ownerId !== options.actor.profileId) throw new ExecutionError('not_found');
  if (
    options.resumeUpload
      ? record.state !== 'uncertain' || record.providerPostId !== null
      : record.state !== 'pending'
  )
    return;
  const context = await options.store.context(record.ownerId, record.id);
  const asset = MediaAssetSchema.safeParse(context.asset);
  const destination = record.preview.destinations.find(
    (item) => item.connectionId === record.connectionId,
  );
  if (
    !destination ||
    destination.platform !== options.publisher.platform ||
    !asset.success ||
    asset.data.ownerId !== record.ownerId ||
    asset.data.id !== record.preview.mediaId ||
    asset.data.runId !== record.preview.runId ||
    asset.data.sha256 !== record.preview.mediaSha256 ||
    record.digest !== (await publicationPreviewDigest(record.preview)) ||
    !(await publicationIsDue({
      ownerId: record.ownerId,
      preview: record.preview,
      approval: context.approval,
      connections: context.connections,
      now: options.now,
    }))
  )
    throw new ExecutionError('approval_mismatch');
  if (
    !options.resumeUpload &&
    !(await options.store.claim(record.ownerId, record.id, record.digest))
  )
    return;
  if (options.resumeUpload && !options.publisher.resume)
    throw new ExecutionError('provider_unavailable');
  try {
    const operation = options.resumeUpload
      ? options.publisher.resume!.bind(options.publisher)
      : options.publisher.publish.bind(options.publisher);
    const posted = await operation({
      connectionId: destination.connectionId,
      caption: destination.caption,
      asset: asset.data,
      deliveryId: record.id,
      signal: AbortSignal.timeout(60_000),
    });
    if (typeof posted.postId !== 'string' || !posted.postId.length || posted.postId.length > 300)
      throw new Error('Delivery not confirmed.');
    await options.store.submitted(record.ownerId, record.id, posted.postId);
    if (
      !(await options.publisher.verify({
        connectionId: destination.connectionId,
        postId: posted.postId,
        caption: destination.caption,
        asset: asset.data,
        signal: AbortSignal.timeout(30_000),
      }))
    )
      throw new Error('Delivery not confirmed.');
    await options.store.finish(record.ownerId, record.id, posted.postId);
  } catch {
    // A competing continuation may already own dispatching; never overwrite its state.
    if (!options.resumeUpload) await options.store.finish(record.ownerId, record.id, null);
    throw new ExecutionError('provider_unavailable');
  }
}

/** Read back a known ambiguous post; this operation never calls publish again. */
export async function reconcilePublication(
  options: Parameters<typeof deliverPublication>[0],
): Promise<void> {
  if (!options.enabled) throw new ExecutionError('disabled');
  if (!options.actor.active) throw new ExecutionError('membership_required');
  const record = await options.store.read(options.actor.profileId, options.deliveryId);
  if (!record || record.ownerId !== options.actor.profileId) throw new ExecutionError('not_found');
  if (record.state !== 'uncertain' || !record.providerPostId) return;
  const context = await options.store.context(record.ownerId, record.id);
  const asset = MediaAssetSchema.safeParse(context.asset);
  const destination = record.preview.destinations.find(
    (item) => item.connectionId === record.connectionId,
  );
  if (
    !asset.success ||
    !destination ||
    destination.platform !== options.publisher.platform ||
    asset.data.ownerId !== record.ownerId ||
    asset.data.id !== record.preview.mediaId ||
    asset.data.runId !== record.preview.runId ||
    asset.data.sha256 !== record.preview.mediaSha256 ||
    record.digest !== (await publicationPreviewDigest(record.preview))
  )
    throw new ExecutionError('approval_mismatch');
  try {
    if (
      await options.publisher.verify({
        connectionId: record.connectionId,
        postId: record.providerPostId,
        caption: destination.caption,
        asset: asset.data,
        signal: AbortSignal.timeout(30_000),
      })
    ) {
      await options.store.finish(record.ownerId, record.id, record.providerPostId);
    }
  } catch {
    throw new ExecutionError('provider_unavailable');
  }
}
