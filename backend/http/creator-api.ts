import type { publicCreatorData } from '../community/creators.ts';
import { CreatorUsernameSchema } from '../../src/domain/creator.ts';
import { assertRequestTarget, HttpFailure, privateFailure, privateJson } from './guard.ts';
export function publicCreatorHandler(origin: string, read: ReturnType<typeof publicCreatorData>) {
  return async (request: Request) => {
    try {
      assertRequestTarget(request, origin);
      const url = new URL(request.url);
      if (url.pathname !== '/api/community/creator/') throw new HttpFailure(404, 'not-found');
      if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      if (
        request.headers.has('sec-fetch-site') &&
        request.headers.get('sec-fetch-site') !== 'same-origin'
      )
        throw new HttpFailure(403, 'request-refused');
      if (
        [...url.searchParams.keys()].some((key) => key !== 'username') ||
        url.searchParams.getAll('username').length !== 1
      )
        throw new HttpFailure(400, 'invalid-request');
      const name = CreatorUsernameSchema.safeParse(url.searchParams.get('username'));
      if (!name.success) throw new HttpFailure(400, 'invalid-request');
      const creator = await read(name.data);
      if (!creator) throw new HttpFailure(404, 'not-found');
      return privateJson(creator);
    } catch (error) {
      return privateFailure(error);
    }
  };
}
