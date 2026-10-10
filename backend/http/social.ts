import { z } from 'zod';
import type { IdentityRuntime } from '../auth/runtime.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { workspaceData } from '../workspace/data.ts';
import { mediaCapabilities } from '../execution/media-controls.ts';
import { socialOAuth } from '../integrations/oauth.ts';
import { integrationStore } from '../integrations/store.ts';
import { sha256 } from '../integrations/http.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';
const PlatformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
export function socialHandler(
  runtime: IdentityRuntime,
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      const matched = /^\/api\/social\/(instagram|facebook|linkedin)\/(start|callback)\/$/.exec(
        url.pathname,
      );
      const status = url.pathname === '/api/social/';
      if (!status && !matched) throw new HttpFailure(404, 'not-found');
      if (status && (request.method !== 'GET' || url.search))
        throw new HttpFailure(400, 'invalid-request');
      if (matched?.[2] === 'start') {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        await assertCsrf(runtime, request);
        z.strictObject({}).parse(await readJsonBody(request, 1000));
      } else if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      const session = await authenticatedSession(runtime, request);
      const identity = await workspaceData(
        runtime.configuration,
        session.provider,
        transport,
      ).identity();
      if (identity.profile?.status !== 'active') throw new HttpFailure(403, 'request-refused');
      const capabilities = mediaCapabilities(environment);
      if (status)
        return privateJson({
          enabled: capabilities.connect,
          publishingEnabled: capabilities.publish,
          platforms: ['instagram', 'facebook', 'linkedin'],
        });
      if (!capabilities.connect) throw new HttpFailure(503, 'service-unavailable');
      const platform = PlatformSchema.parse(matched![1]);
      const encodedKey = z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(environment.AGENTGRID_SOCIAL_TOKEN_KEY);
      const key = Uint8Array.from(encodedKey.match(/../g)!, (value) => parseInt(value, 16));
      const now = () => new Date(runtime.now() * 1000);
      const store = integrationStore(environment, session.provider.subject, key, now, transport);
      const oauth = socialOAuth({
        enabled: () => mediaCapabilities(environment).connect,
        transport,
        now,
        store: store.oauth,
        key,
        origin: runtime.configuration.origin,
        metaVersion: z.string().parse(environment.AGENTGRID_META_API_VERSION),
        credentials: async (p) => ({
          clientId: z
            .string()
            .parse(
              environment[
                p === 'linkedin' ? 'AGENTGRID_LINKEDIN_CLIENT_ID' : 'AGENTGRID_META_CLIENT_ID'
              ],
            ),
          clientSecret: z
            .string()
            .parse(
              environment[
                p === 'linkedin'
                  ? 'AGENTGRID_LINKEDIN_CLIENT_SECRET'
                  : 'AGENTGRID_META_CLIENT_SECRET'
              ],
            ),
        }),
      });
      const sessionDigest = await sha256(new TextEncoder().encode(session.digest));
      if (matched![2] === 'start')
        return privateJson(await oauth.start(identity.profile.id, sessionDigest, platform));
      if (
        [...url.searchParams.keys()].some(
          (k) => !['code', 'state', 'error', 'error_description', 'error_reason'].includes(k),
        ) ||
        [...url.searchParams.keys()].some((k) => url.searchParams.getAll(k).length !== 1)
      )
        throw new HttpFailure(400, 'invalid-request');
      await oauth.complete({
        ownerId: identity.profile.id,
        sessionDigest,
        platform,
        state: url.searchParams.get('state') ?? '',
        ...(url.searchParams.has('code') ? { code: url.searchParams.get('code')! } : {}),
        denied: url.searchParams.has('error'),
        signal: request.signal,
      });
      const headers = new Headers(privateJson({}).headers);
      headers.set('Location', runtime.configuration.origin + '/workspace/reels/');
      return new Response(null, { status: 303, headers });
    } catch (error) {
      return privateFailure(error);
    }
  };
}
