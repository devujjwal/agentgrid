/** Public catalogue paths only. Never transmit queries, fragments or private account routes. */
export const googleMeasurementId = 'G-QFECS8NSVF';
export const analyticsChoiceKey = 'agentgrid-analytics-2026-10-10';
export function publicMeasurementPath(path: string): string | null {
  return path === '/' ||
    /^\/(agents|recipes|categories|learn|platforms|integrations|mcp)\/(?:[a-z0-9-]+\/)?$/.test(path)
    ? path
    : null;
}
export function analyticsPermitted(
  origin: string,
  choice: string | null,
  dnt: string | null,
  gpc: boolean,
) {
  return origin === 'https://agentgrid.me' && choice === 'granted' && dnt !== '1' && !gpc;
}
export function publicPageEvent(path: string) {
  const safe = publicMeasurementPath(path);
  return safe
    ? {
        page_location: 'https://agentgrid.me' + safe,
        page_referrer: '',
        page_title: 'AgentGrid',
        send_to: googleMeasurementId,
      }
    : null;
}
