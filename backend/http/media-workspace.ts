import { readPrivateVideo, type PrivateMediaBucket } from '../execution/media.ts';
import { z } from 'zod';
import type { IdentityRuntime } from '../auth/runtime.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { workspaceData } from '../workspace/data.ts';
import { mediaWorkspaceStore } from '../integrations/workspace-store.ts';
import { reelStore } from '../execution/reel-store.ts';
import { mediaCapabilities } from '../execution/media-controls.ts';
import { prepareReel } from '../execution/reels.ts';
import { shotstackProvider } from '../integrations/shotstack.ts';
import {
  PublicationPreviewSchema,
  ReelSummarySchema,
  ConnectionSummarySchema,
} from '../../src/domain/media-workspace.ts';
import { ReelPlanSchema } from '../../src/domain/reels.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';
const IdSchema = z.strictObject({ id: z.uuid() });
const ApprovalSchema = z.strictObject({
  id: z.uuid(),
  digest: z.string().regex(/^[a-f0-9]{64}$/),
  confirmed: z.literal(true),
});
const EnableSchema = ConnectionSummarySchema.omit({ publishingEnabled: true }).extend({
  confirmed: z.literal(true),
});
export function mediaWorkspaceHandler(
  runtime: IdentityRuntime,
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      const video = url.pathname === '/api/media/video/';
      if (url.search && !(video && url.searchParams.size === 1 && url.searchParams.has('id')))
        throw new HttpFailure(400, 'invalid-request');
      const operation = url.pathname.slice('/api/media/'.length).replace(/\/$/, '');
      if (
        url.pathname !== '/api/media/' &&
        ![
          'prepare-reel',
          'approve-reel',
          'cancel-reel',
          'prepare-publication',
          'approve-publication',
          'cancel-publication',
          'enable-connection',
          'disable-connection',
          'disconnect',
          'inspect',
          'resume',
          'reconcile',
          'video',
        ].includes(operation)
      )
        throw new HttpFailure(404, 'not-found');
      if (operation && !video) await assertCsrf(runtime, request);
      else if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      const session = await authenticatedSession(runtime, request);
      const identity = await workspaceData(
        runtime.configuration,
        session.provider,
        transport,
      ).identity();
      if (identity.profile?.status !== 'active') throw new HttpFailure(403, 'request-refused');
      if (video) {
        const id = z.uuid().parse(url.searchParams.get('id'));
        const record = await reelStore(environment, session.provider.subject, transport).reels.read(
          identity.profile.id,
          id,
        );
        const bucket = environment.AGENTGRID_MEDIA_BUCKET as PrivateMediaBucket | undefined;
        if (
          record?.ownerId !== identity.profile.id ||
          record.state !== 'ready' ||
          !record.asset ||
          !bucket
        )
          throw new HttpFailure(404, 'not-found');
        return await readPrivateVideo(identity.profile.id, record.asset, bucket);
      }
      const flags = mediaCapabilities(environment);
      const workspace = mediaWorkspaceStore(environment, session.provider.subject, transport);
      if (!operation) {
        const overview = await workspace.overview();
        return privateJson({
          ...overview,
          capabilities: {
            connect: flags.connect && overview.capabilities.connect,
            render: flags.render && overview.capabilities.render,
            publish: flags.publish && overview.capabilities.publish,
            schedule:
              flags.publish &&
              overview.capabilities.publish &&
              environment.AGENTGRID_SOCIAL_SCHEDULER_ENABLED === '1',
          },
        });
      }
      const body = await readJsonBody(request, 40000);
      const ledger = reelStore(environment, session.provider.subject, transport);
      // Revocation and cancellation remain available with execution off.
      if (['disable-connection', 'cancel-publication'].includes(operation)) {
        await workspace.mutate(
          operation as 'disable-connection' | 'cancel-publication',
          IdSchema.parse(body),
        );
        return privateJson(null);
      }
      if (operation === 'disconnect') {
        await ledger.disconnect(IdSchema.parse(body).id);
        return privateJson(null);
      }
      if (operation === 'cancel-reel') {
        await ledger.cancelReel(IdSchema.parse(body).id);
        return privateJson(null);
      }
      const render = ['prepare-reel', 'approve-reel', 'inspect'].includes(operation);
      if (render ? !flags.render : !flags.publish)
        throw new HttpFailure(503, 'service-unavailable');
      if (operation === 'enable-connection') {
        await workspace.mutate('enable-connection', EnableSchema.parse(body));
        return privateJson(null);
      }
      if (operation === 'prepare-reel') {
        const parsed = z
          .strictObject({ idempotencyKey: z.uuid(), plan: ReelPlanSchema })
          .parse(body);
        const provider = shotstackProvider({
          enabled: () => false,
          transport: async () => {
            throw new Error('Preview never calls a provider.');
          },
          apiKey: async () => {
            throw new Error('Preview never reads credentials.');
          },
          rates: JSON.parse(z.string().parse(environment.AGENTGRID_RENDER_RATE_CEILING)),
          outputHosts: [],
          bucket: { put: async () => {}, get: async () => null, delete: async () => {} },
          probe: {
            inspect: async () => {
              throw new Error('Preview never decodes video.');
            },
          },
          context: async () => null,
          billedCost: async () => null,
        });
        const prepared = await prepareReel({
          enabled: true,
          actor: { profileId: identity.profile.id, active: true },
          request: parsed,
          provider,
          store: ledger.reels,
        });
        const overview = await workspace.overview();
        return privateJson(
          ReelSummarySchema.parse(overview.reels.find((r) => r.id === prepared.id)),
          201,
        );
      }
      if (operation === 'prepare-publication') {
        const id = await ledger.preparePublication(PublicationPreviewSchema.parse(body));
        const overview = await workspace.overview();
        const publication = overview.publications.find((p) => p.id === id);
        if (!publication) throw new HttpFailure(503, 'service-unavailable');
        return privateJson(publication, 201);
      }
      const queue = environment.AGENTGRID_EXECUTION_QUEUE as
        { send?: (body: unknown) => Promise<void> } | undefined;
      if (!queue?.send) throw new HttpFailure(503, 'service-unavailable');
      if (operation === 'approve-reel') {
        const approval = ApprovalSchema.parse(body);
        await ledger.approveReel(approval.id, approval.digest);
        await queue.send({
          kind: 'render',
          subject: session.provider.subject,
          id: approval.id,
          digest: approval.digest,
        });
        return privateJson(null, 202);
      }
      if (operation === 'approve-publication') {
        const approval = ApprovalSchema.parse(body);
        const before = await workspace.overview();
        const requested = before.publications.find(
          (p) => p.id === approval.id && p.digest === approval.digest,
        );
        if (!requested) throw new HttpFailure(409, 'conflict');
        if (
          Date.parse(requested.preview.scheduledAt) > runtime.now() * 1000 &&
          environment.AGENTGRID_SOCIAL_SCHEDULER_ENABLED !== '1'
        )
          throw new HttpFailure(503, 'service-unavailable');
        await ledger.approvePublication(approval.id, approval.digest);
        const overview = await workspace.overview();
        const publication = overview.publications.find((p) => p.id === approval.id);
        if (!publication || publication.digest !== approval.digest)
          throw new HttpFailure(409, 'conflict');
        if (Date.parse(publication.preview.scheduledAt) <= runtime.now() * 1000)
          for (const delivery of publication.deliveries)
            await queue.send({
              kind: 'publish',
              subject: session.provider.subject,
              id: delivery.id,
              digest: publication.digest,
            });
        return privateJson(null, 202);
      }
      const confirmation = ApprovalSchema.parse(body);
      const overview = await workspace.overview();
      if (operation === 'inspect') {
        const reel = overview.reels.find(
          (r) =>
            r.id === confirmation.id && r.digest === confirmation.digest && r.state === 'rendering',
        );
        if (!reel) throw new HttpFailure(409, 'conflict');
        await queue.send({
          kind: 'inspect',
          subject: session.provider.subject,
          id: reel.id,
          digest: reel.digest,
        });
      } else {
        const publication = overview.publications.find(
          (p) =>
            p.digest === confirmation.digest && p.deliveries.some((d) => d.id === confirmation.id),
        );
        const delivery = publication?.deliveries.find((d) => d.id === confirmation.id);
        if (
          !delivery ||
          delivery.state !== 'uncertain' ||
          (operation === 'resume' && !delivery.canResume)
        )
          throw new HttpFailure(409, 'conflict');
        await queue.send({
          kind: operation,
          subject: session.provider.subject,
          id: delivery.id,
          digest: publication!.digest,
        });
      }
      return privateJson(null, 202);
    } catch (error) {
      if (error instanceof z.ZodError)
        return privateFailure(new HttpFailure(400, 'invalid-request'));
      return privateFailure(error);
    }
  };
}
