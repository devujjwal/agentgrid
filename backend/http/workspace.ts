import { z } from 'zod';
import type { IdentityRuntime } from '../auth/runtime.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import { assertCsrf } from '../auth/csrf.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import type { WorkspaceData } from '../workspace/data.ts';
import { ProfileInputSchema, OnboardingInputSchema } from '../../src/domain/workspace.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';

async function input<T>(request: Request, schema: z.ZodType<T>) {
  const parsed = schema.safeParse(await readJsonBody(request, 10_000));
  if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
  return parsed.data;
}
export function workspaceHandler(
  runtime: IdentityRuntime,
  dataForSession: (session: ProviderSession) => WorkspaceData,
) {
  return async (request: Request): Promise<Response> => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      const read = ['/api/workspace/', '/api/workspace/agents/'].includes(url.pathname);
      const mutation = [
        '/api/workspace/onboard/',
        '/api/workspace/profile/',
        '/api/workspace/visibility/',
        '/api/workspace/favorite/',
      ].includes(url.pathname);
      if (!read && !mutation) throw new HttpFailure(404, 'not-found');
      if (read && request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      if (
        read &&
        request.headers.has('sec-fetch-site') &&
        request.headers.get('sec-fetch-site') !== 'same-origin'
      )
        throw new HttpFailure(403, 'request-refused');
      if (mutation) {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        await assertCsrf(runtime, request);
      }
      const session = await authenticatedSession(runtime, request);
      const data = dataForSession(session.provider);
      if (url.pathname === '/api/workspace/') {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.identity());
      }
      if (url.pathname.endsWith('/agents/')) {
        if (
          [...url.searchParams.keys()].some((key) => key !== 'offset') ||
          url.searchParams.getAll('offset').length > 1
        )
          throw new HttpFailure(400, 'invalid-request');
        const offset = url.searchParams.get('offset') ?? '0';
        if (!/^\d{1,4}$/.test(offset)) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.agents(Number(offset)));
      }
      if (url.pathname.endsWith('/onboard/'))
        await data.onboard(await input(request, OnboardingInputSchema));
      else if (url.pathname.endsWith('/profile/'))
        await data.updateProfile(await input(request, ProfileInputSchema));
      else if (url.pathname.endsWith('/visibility/')) {
        const value = await input(request, z.strictObject({ public: z.boolean() }));
        await data.visibility(value.public);
      } else {
        const value = await input(
          request,
          z.strictObject({ resourceId: z.uuid(), saved: z.boolean() }),
        );
        return privateJson({ saved: await data.favorite(value.resourceId, value.saved) });
      }
      return privateJson({ updated: true });
    } catch (error) {
      return privateFailure(error);
    }
  };
}
