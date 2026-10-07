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
import { publicReviewData } from '../community/reviews.ts';
import { publicCommunityHandler } from './community.ts';
import { moderationHandler } from './moderation.ts';

export interface PagesIdentityContext {
  request: Request;
  env: Record<string, unknown>;
}
export async function pagesIdentityRequest(context: PagesIdentityContext): Promise<Response> {
  try {
    if (new URL(context.request.url).pathname.startsWith('/api/community/')) {
      const configuration = publicCommunityConfiguration(context.env);
      return await publicCommunityHandler(
        configuration.origin,
        publicReviewData(configuration),
      )(context.request);
    }
    const configuration = authConfiguration(context.env);
    const runtime = await identityRuntime(
      configuration,
      identityStore(configuration),
      managedIdentity(configuration),
    );
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
