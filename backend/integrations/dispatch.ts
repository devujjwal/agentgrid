import { z } from 'zod';
import { mediaCapabilities } from '../execution/media-controls.ts';
import { reelStore } from '../execution/reel-store.ts';
import { readPrivateVideo, type PrivateMediaBucket } from '../execution/media.ts';
import { renderReel, inspectReel } from '../execution/reels.ts';
import { deliverPublication, reconcilePublication } from '../execution/social-delivery.ts';
import { integrationStore } from './store.ts';
import { integrationKey, issueMediaGrant } from './media-grant.ts';
import { socialPublisher } from './social.ts';
import { shotstackProvider } from './shotstack.ts';
import { remoteVideoProbe } from './video-probe.ts';
const JobSchema = z.strictObject({
  kind: z.enum(['render', 'inspect', 'publish', 'reconcile', 'resume']),
  subject: z.uuid(),
  id: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
});
/** Private queue entry point, never a public HTTP body. No automatic repost/re-render.
 * Billing evidence is injected from a separately trusted reconciler, never provider estimates.
 */
export async function dispatchMediaJob(
  evidence: unknown,
  environment: Record<string, unknown>,
  dependencies: {
    transport?: typeof fetch;
    now?: () => Date;
    verifiedBilledCost?: (taskId: string) => Promise<number | null>;
  } = {},
) {
  const job = JobSchema.parse(evidence);
  const flags = mediaCapabilities(environment);
  const rendering = job.kind === 'render' || job.kind === 'inspect';
  if (rendering ? !flags.render : !flags.publish) return;
  const transport = dependencies.transport ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  const client = reelStore(environment, job.subject, transport);
  const bucket = environment.AGENTGRID_MEDIA_BUCKET as PrivateMediaBucket | undefined;
  if (!bucket || typeof bucket.get !== 'function' || typeof bucket.put !== 'function')
    throw new Error('Private media storage unavailable.');
  if (rendering) {
    const record = await client.reels.read('', job.id);
    if (!record || record.digest !== job.digest) return;
    const rates = z
      .strictObject({
        revision: z.string(),
        imageMicros: z.number(),
        speechCharacterMicros: z.number(),
        renderSecondMicros: z.number(),
      })
      .parse(JSON.parse(z.string().parse(environment.AGENTGRID_RENDER_RATE_CEILING)));
    const hosts = z
      .array(z.string().regex(/^[a-z0-9.-]+$/))
      .min(1)
      .max(10)
      .parse(JSON.parse(z.string().parse(environment.AGENTGRID_RENDER_OUTPUT_HOSTS)));
    const probeOrigin = z.url().parse(environment.AGENTGRID_VIDEO_PROBE_ORIGIN);
    const provider = shotstackProvider({
      enabled: () => mediaCapabilities(environment).render,
      transport,
      apiKey: async () => z.string().parse(environment.SHOTSTACK_API_KEY),
      rates,
      outputHosts: hosts,
      bucket,
      probe: remoteVideoProbe({
        enabled: () => mediaCapabilities(environment).render,
        origin: probeOrigin,
        allowedHosts: [new URL(probeOrigin).hostname],
        key: async () => z.string().parse(environment.AGENTGRID_PROBE_KEY),
        transport,
      }),
      context: async (taskId) => {
        const latest = await client.reels.read(record.ownerId, record.id);
        return latest?.taskId === taskId && latest.state === 'rendering'
          ? {
              ownerId: latest.ownerId,
              runId: latest.id,
              maximumCostMicros: latest.maximumCostMicros,
            }
          : null;
      },
      billedCost: dependencies.verifiedBilledCost ?? (async () => null),
    });
    const options = {
      enabled: true,
      actor: { profileId: record.ownerId, active: true },
      runId: record.id,
      approvedDigest: job.digest,
      provider,
      store: client.reels,
    };
    if (job.kind === 'render') await renderReel(options);
    else await inspectReel(options);
    return;
  }
  const record = await client.deliveries.read('', job.id);
  if (!record || record.digest !== job.digest) return;
  const destination = record.preview.destinations.find(
    (d) => d.connectionId === record.connectionId,
  );
  if (!destination) return;
  const connectionStore = integrationStore(
    environment,
    job.subject,
    integrationKey(environment, 'AGENTGRID_SOCIAL_TOKEN_KEY'),
    now,
    transport,
  );
  const origin = z
    .enum(['https://agentgrid.me', 'https://agentgrid-staging.pages.dev'])
    .parse(environment.AGENTGRID_ORIGIN);
  const publisher = socialPublisher(destination.platform, {
    enabled: () => mediaCapabilities(environment).publish,
    transport,
    now,
    connection: connectionStore.connection,
    receipts: connectionStore.receipts,
    metaVersion: z.string().parse(environment.AGENTGRID_META_API_VERSION),
    bytes: async (asset) =>
      new Uint8Array(await (await readPrivateVideo(record.ownerId, asset, bucket)).arrayBuffer()),
    mediaHosts: [new URL(origin).hostname],
    mediaUrl: async (asset, connectionId) =>
      origin +
      '/api/social/media/?grant=' +
      (await issueMediaGrant({
        enabled: () => mediaCapabilities(environment).publish,
        key: integrationKey(environment, 'AGENTGRID_MEDIA_GRANT_KEY'),
        subject: job.subject,
        connectionId,
        asset,
        now: now(),
        seconds: 900,
      })),
  });
  const options = {
    enabled: true,
    actor: { profileId: record.ownerId, active: true },
    deliveryId: record.id,
    store: client.deliveries,
    publisher,
    now: now(),
  };
  if (job.kind === 'reconcile' && record.state === 'uncertain' && record.providerPostId === null)
    await connectionStore.recover(record.id, record.connectionId);
  if (job.kind === 'publish' || job.kind === 'resume')
    await deliverPublication({ ...options, resumeUpload: job.kind === 'resume' });
  else await reconcilePublication(options);
}
