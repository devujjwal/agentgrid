import { analyticsHandler } from '../analytics/collector.ts';
import { analyticsStore } from '../analytics/store.ts';
import { authConfiguration } from '../auth/configuration.ts';
import { identityRuntime } from '../auth/runtime.ts';
import { managedIdentity } from '../auth/managed.ts';
import { identityStore } from '../auth/store.ts';
import { sendSignInEmail } from '../email/resend.ts';
import { identityHandler } from './identity.ts';
import { privateFailure } from './guard.ts';
import { workspaceHandler } from './workspace.ts';
import { workspaceData } from '../workspace/data.ts';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { publicCreatorData } from '../community/creators.ts';
import { publicCreatorHandler } from './creator-api.ts';
import { publicReviewData } from '../community/reviews.ts';
import { publicCommunityHandler } from './community.ts';
import { moderationHandler } from './moderation.ts';
import { administrationHandler } from './administration.ts';

export interface PagesIdentityContext {
  request: Request;
  env: Record<string, unknown>;
}
export async function pagesIdentityRequest(context: PagesIdentityContext): Promise<Response> {
  try {
    if (new URL(context.request.url).pathname.startsWith('/api/analytics')) {
      const configuration = publicCommunityConfiguration(context.env);
      const enabled = context.env.AGENTGRID_ANALYTICS_ENABLED === '1';
      return await analyticsHandler(
        configuration.origin,
        enabled,
        enabled ? analyticsStore(context.env) : async () => {},
      )(context.request);
    }
    if (new URL(context.request.url).pathname.startsWith('/api/community/')) {
      const configuration = publicCommunityConfiguration(context.env);
      if (new URL(context.request.url).pathname === '/api/community/creator/')
        return publicCreatorHandler(
          configuration.origin,
          publicCreatorData(configuration),
        )(context.request);
      return await publicCommunityHandler(
        configuration.origin,
        publicReviewData(configuration),
      )(context.request);
    }
    const configuration = authConfiguration(context.env);
    const runtime = await identityRuntime(
      configuration,
      identityStore(configuration, fetch, (event) => {
        console.warn('agentgrid_identity_dependency_failure', event.operation, event.status);
      }),
      managedIdentity(configuration),
    );
    if (new URL(context.request.url).pathname.startsWith('/api/admin/'))
      return await administrationHandler(
        runtime,
        (session) => workspaceData(configuration, session).administration,
      )(context.request);
    if (new URL(context.request.url).pathname.startsWith('/api/moderation/'))
      return await moderationHandler(
        runtime,
        (session) => workspaceData(configuration, session).moderation,
      )(context.request);
    if (new URL(context.request.url).pathname.startsWith('/api/workspace/'))
      return await workspaceHandler(runtime, (session) => workspaceData(configuration, session))(
        context.request,
      );
    const handler = identityHandler(runtime, (email) =>
      sendSignInEmail(
        {
          apiKey: configuration.resendKey,
          fromEmail: configuration.fromEmail,
        },
        email,
      ),
    );
    // This wrapper runs only on Pages, where Cloudflare replaces this header.
    // No X-Forwarded-For fallback and no client body/header-selected identity.
    return await handler(context.request, context.request.headers.get('CF-Connecting-IP') ?? '');
  } catch (error) {
    return privateFailure(error);
  }
}
