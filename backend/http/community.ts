import { z } from 'zod';
import type { publicReviewData } from '../community/reviews.ts';
import { assertRequestTarget, HttpFailure, privateFailure, privateJson } from './guard.ts';

/** No session verification, opaque cookie, member lookup or secret-key use. */
export function publicCommunityHandler(
  origin: string,
  reviews: ReturnType<typeof publicReviewData>,
) {
  return async (request: Request): Promise<Response> => {
    try {
      assertRequestTarget(request, origin);
      const url = new URL(request.url);
      if (url.pathname !== '/api/community/reviews/') throw new HttpFailure(404, 'not-found');
      if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
      if (
        request.headers.has('sec-fetch-site') &&
        request.headers.get('sec-fetch-site') !== 'same-origin'
      )
        throw new HttpFailure(403, 'request-refused');
      if (
        [...url.searchParams.keys()].some((key) => !['resourceId', 'offset'].includes(key)) ||
        url.searchParams.getAll('resourceId').length !== 1 ||
        url.searchParams.getAll('offset').length > 1
      )
        throw new HttpFailure(400, 'invalid-request');
      const resource = z.uuid().safeParse(url.searchParams.get('resourceId')),
        offset = url.searchParams.get('offset') ?? '0';
      if (!resource.success || !/^\d{1,4}$/.test(offset))
        throw new HttpFailure(400, 'invalid-request');
      // No cache keeps takedowns, profile privacy and moderation changes live.
      // Public JSON is still excluded from crawler indexes; canonical resources
      // provide factual, crawlable editorial content in their static HTML.
      return privateJson(await reviews(resource.data, Number(offset)));
    } catch (error) {
      return privateFailure(error);
    }
  };
}
