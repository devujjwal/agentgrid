import { providerFetch } from '../http/provider-fetch.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { PublicReviewSchema, PublicReviewsSchema } from '../../src/domain/reviews.ts';
import type { AuthConfiguration } from '../auth/configuration.ts';
import { HttpFailure } from '../http/guard.ts';
import { databaseFailure } from '../workspace/failure.ts';

const Projection = z
  .strictObject({
    resourceId: z.uuid(),
    reviewCount: PublicReviewsSchema.shape.reviewCount,
    averageRating: PublicReviewsSchema.shape.averageRating,
    reviews: z.array(PublicReviewSchema).max(21),
  })
  .refine(
    (value) => new Set(value.reviews.map((review) => review.id)).size === value.reviews.length,
  );
/** Anonymous public projection only. No privileged key or provider session. */
export function publicReviewData(
  configuration: Pick<AuthConfiguration, 'supabaseOrigin' | 'publishableKey'>,
  transport: typeof fetch = fetch,
) {
  const client = createClient(configuration.supabaseOrigin, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        providerFetch(transport, input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
  return async (resourceId: string, offset: number) => {
    const result = await client.rpc('agentgrid_public_reviews', {
      resource_id: resourceId,
      requested_offset: offset,
    });
    if (result.error) databaseFailure(result.error);
    if (result.data === null) throw new HttpFailure(404, 'not-found');
    const projection = Projection.safeParse(result.data);
    if (!projection.success || projection.data.resourceId !== resourceId)
      throw new HttpFailure(503, 'service-unavailable');
    const value = projection.data;
    const parsed = PublicReviewsSchema.safeParse({
      ...value,
      reviews: value.reviews.slice(0, 20),
      hasMore: value.reviews.length > 20,
      offset,
    });
    if (!parsed.success || value.reviews.length > value.reviewCount)
      throw new HttpFailure(503, 'service-unavailable');
    return parsed.data;
  };
}
