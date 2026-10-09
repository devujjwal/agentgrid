import type { AnalyticsEvent } from '../domain/analytics.ts';
/** Lightweight allowlist at the transmission boundary; never spread caller objects. */
export function measurementPayload(value: AnalyticsEvent): AnalyticsEvent | null {
  if (!value || typeof value !== 'object') return null;
  if (value.event === 'page_view')
    return [
      'home',
      'agents',
      'recipes',
      'categories',
      'learn',
      'platforms',
      'integrations',
      'mcp',
    ].includes(value.page)
      ? { event: value.event, page: value.page }
      : null;
  if (value.event === 'search')
    return ['all', 'agent', 'recipe', 'category', 'integration'].includes(value.kind) &&
      ['none', 'one', 'few', 'many'].includes(value.results)
      ? { event: value.event, kind: value.kind, results: value.results }
      : null;
  if (
    !['agent_view', 'copy_instructions', 'platform_select', 'definition_download'].includes(
      value.event,
    )
  )
    return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!uuid.test(value.resourceId) || !uuid.test(value.versionId)) return null;
  if (value.event === 'copy_instructions' || value.event === 'platform_select')
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.platform) && value.platform.length <= 40
      ? {
          event: value.event,
          resourceId: value.resourceId,
          versionId: value.versionId,
          platform: value.platform,
        }
      : null;
  return { event: value.event, resourceId: value.resourceId, versionId: value.versionId };
}
