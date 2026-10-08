import type { IdentityRuntime } from '../auth/runtime.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import type { profileGovernance } from '../workspace/profile-governance.ts';
import { ProfileDecisionSchema } from '../../src/domain/profile-governance.ts';
import { ProfileSchema } from '../../src/domain/workspace.ts';
import { authenticatedSession } from '../auth/sessions.ts';
import { assertCsrf } from '../auth/csrf.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateFailure,
  privateJson,
  readJsonBody,
} from './guard.ts';
export function administrationHandler(
  runtime: IdentityRuntime,
  dataForSession: (session: ProviderSession) => ReturnType<typeof profileGovernance>,
) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      const url = new URL(request.url);
      if (!['/api/admin/profile/', '/api/admin/profile-decision/'].includes(url.pathname))
        throw new HttpFailure(404, 'not-found');
      const mutation = url.pathname === '/api/admin/profile-decision/';
      if (mutation) {
        if (url.search) throw new HttpFailure(400, 'invalid-request');
        await assertCsrf(runtime, request);
      } else {
        if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
        if (
          request.headers.has('sec-fetch-site') &&
          request.headers.get('sec-fetch-site') !== 'same-origin'
        )
          throw new HttpFailure(403, 'request-refused');
      }
      const session = await authenticatedSession(runtime, request),
        data = dataForSession(session.provider);
      if (mutation) {
        const parsed = ProfileDecisionSchema.safeParse(await readJsonBody(request, 12000));
        if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
        return privateJson(await data.decide(parsed.data));
      }
      if (
        [...url.searchParams.keys()].some((key) => key !== 'username') ||
        url.searchParams.getAll('username').length !== 1
      )
        throw new HttpFailure(400, 'invalid-request');
      const username = ProfileSchema.shape.username.safeParse(url.searchParams.get('username'));
      if (!username.success) throw new HttpFailure(400, 'invalid-request');
      return privateJson(await data.profile(username.data));
    } catch (error) {
      return privateFailure(error);
    }
  };
}
