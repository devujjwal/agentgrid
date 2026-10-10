import type { PrivateMediaBucket } from '../execution/media.ts';
import { readPrivateVideo } from '../execution/media.ts';
import { reelStore } from '../execution/reel-store.ts';
import { mediaCapabilities } from '../execution/media-controls.ts';
import { integrationStore } from '../integrations/store.ts';
import { integrationKey, openMediaGrant } from '../integrations/media-grant.ts';
import { assertRequestTarget, HttpFailure, privateFailure } from './guard.ts';
/** Narrow unauthenticated provider fetch capability; off by default, encrypted, 15 min maximum.
 * Every fetch rechecks connection revocation, owner, ready ledger asset and checksum.
 */
export function providerMediaHandler(
  origin: string,
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
  now: () => Date = () => new Date(),
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, origin);
      const url = new URL(request.url);
      if (
        request.method !== 'GET' ||
        url.pathname !== '/api/social/media/' ||
        url.searchParams.size !== 1 ||
        !url.searchParams.has('grant')
      )
        throw new HttpFailure(400, 'invalid-request');
      if (!mediaCapabilities(environment).publish)
        throw new HttpFailure(503, 'service-unavailable');
      const grant = await openMediaGrant(
        integrationKey(environment, 'AGENTGRID_MEDIA_GRANT_KEY'),
        url.searchParams.get('grant')!,
        now(),
      );
      const client = integrationStore(
        environment,
        grant.subject,
        integrationKey(environment, 'AGENTGRID_SOCIAL_TOKEN_KEY'),
        now,
        transport,
      );
      const connection = await client.connection(grant.connectionId);
      if (connection.ownerId !== grant.asset.ownerId || connection.platform !== 'instagram')
        throw new HttpFailure(403, 'request-refused');
      const record = await reelStore(environment, grant.subject, transport).reels.read(
        grant.asset.ownerId,
        grant.asset.runId,
      );
      if (
        record?.state !== 'ready' ||
        record.asset?.id !== grant.asset.id ||
        record.asset.sha256 !== grant.asset.sha256
      )
        throw new HttpFailure(403, 'request-refused');
      const bucket = environment.AGENTGRID_MEDIA_BUCKET as PrivateMediaBucket | undefined;
      if (!bucket || typeof bucket.get !== 'function')
        throw new HttpFailure(503, 'service-unavailable');
      const response = await readPrivateVideo(grant.asset.ownerId, record.asset, bucket);
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    } catch (error) {
      return privateFailure(error);
    }
  };
}
