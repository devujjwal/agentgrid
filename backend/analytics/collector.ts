import { AnalyticsEventSchema, type AnalyticsEvent } from '../../src/domain/analytics.ts';
import { assertMutationOrigin, HttpFailure, privateFailure, readJsonBody } from '../http/guard.ts';
export type RecordAnalytics = (event: AnalyticsEvent) => Promise<void>;
/** No session/auth lookup, cookies, CORS grant or reflection of provider errors. */
export function analyticsHandler(origin: string, enabled: boolean, record: RecordAnalytics) {
  return async (request: Request): Promise<Response> => {
    try {
      assertMutationOrigin(request, origin);
      const url = new URL(request.url);
      if (url.pathname !== '/api/analytics/' || url.search) throw new HttpFailure(404, 'not-found');
      if (enabled && request.headers.get('sec-gpc') !== '1' && request.headers.get('dnt') !== '1') {
        const parsed = AnalyticsEventSchema.safeParse(await readJsonBody(request, 512));
        if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
        // A bounded, best-effort measurement never determines product success.
        await record(parsed.data);
      }
      return new Response(null, {
        status: 204,
        headers: {
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      return privateFailure(error);
    }
  };
}
