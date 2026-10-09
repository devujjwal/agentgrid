import { measurementPayload } from './payload.ts';
import type { AnalyticsEvent } from '../domain/analytics.ts';
export interface MeasurementContext {
  enabled: boolean;
  origin: string;
  doNotTrack: string | null;
  globalPrivacyControl: boolean;
  preview: boolean;
}
export function createMeasurements(context: () => MeasurementContext, transport: typeof fetch) {
  let sent = 0;
  return (event: AnalyticsEvent) => {
    const state = context();
    if (
      !state.enabled ||
      state.preview ||
      state.doNotTrack === '1' ||
      state.globalPrivacyControl ||
      sent >= 20 ||
      state.origin !== 'https://agentgrid.me'
    )
      return;
    const payload = measurementPayload(event);
    if (!payload) return;
    sent++;
    // No cookies, query text, path, referrer, visitor IDs or durable queue. Never retry.
    void transport('/api/analytics/', {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2000),
    }).catch(() => {});
  };
}
export const measure = createMeasurements(
  () => ({
    enabled: process.env.NEXT_PUBLIC_AGENTGRID_ANALYTICS === '1',
    origin: typeof location === 'undefined' ? '' : location.origin,
    doNotTrack: typeof navigator === 'undefined' ? '1' : navigator.doNotTrack,
    globalPrivacyControl:
      typeof navigator !== 'undefined' &&
      (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true,
    preview:
      typeof document !== 'undefined' &&
      Boolean(document.querySelector('[data-agentgrid-preview]')),
  }),
  (...args) => fetch(...args),
);

export function resultBand(count: number): 'none' | 'one' | 'few' | 'many' {
  return count <= 0 ? 'none' : count === 1 ? 'one' : count <= 5 ? 'few' : 'many';
}
