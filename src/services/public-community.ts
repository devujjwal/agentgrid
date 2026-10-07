import { PublicReviewsSchema } from '../domain/reviews.ts';
import { CommunityError } from './community.ts';

/** Live anonymous read. No browser session, credentials, persistence or private cache. */
export async function readPublicReviews(resourceId: string, offset: number, signal: AbortSignal) {
  if (
    !/^[a-fA-F0-9-]{36}$/.test(resourceId) ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 9999
  )
    throw new CommunityError('invalid-request');
  let response: Response;
  try {
    response = await fetch(
      '/api/community/reviews/?resourceId=' + resourceId + '&offset=' + offset,
      {
        credentials: 'omit',
        cache: 'no-store',
        redirect: 'error',
        signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
      },
    );
  } catch {
    throw new CommunityError('service-unavailable');
  }
  if (!response.ok)
    throw new CommunityError(response.status === 404 ? 'not-found' : 'service-unavailable');
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CommunityError('service-unavailable');
  }
  const parsed = PublicReviewsSchema.safeParse(value);
  if (!parsed.success || parsed.data.resourceId !== resourceId || parsed.data.offset !== offset)
    throw new CommunityError('service-unavailable');
  return parsed.data;
}
