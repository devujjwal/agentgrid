import { AnalyticsEventSchema, type AnalyticsEvent } from '../../src/domain/analytics.ts';
import { publicCommunityConfiguration } from '../community/configuration.ts';
import { HttpFailure } from '../http/guard.ts';
export function analyticsStore(
  environment: Record<string, unknown>,
  transport: typeof fetch = fetch,
) {
  const config = publicCommunityConfiguration(environment);
  const key = environment.SUPABASE_SECRET_KEY;
  if (typeof key !== 'string' || !/^sb_secret_[A-Za-z0-9_-]{20,}$/.test(key))
    throw new Error('Analytics configuration unavailable.');
  return async (value: AnalyticsEvent) => {
    const event = AnalyticsEventSchema.parse(value);
    const response = await transport(
      config.supabaseOrigin + '/rest/v1/rpc/agentgrid_analytics_record',
      {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ measurement: event }),
        redirect: 'error',
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!response.ok) throw new HttpFailure(503, 'service-unavailable');
    // No response bodies/provider diagnostics are retained or forwarded.
    await response.body?.cancel();
  };
}
