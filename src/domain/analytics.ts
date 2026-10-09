import { z } from 'zod';
const page = z.enum([
  'home',
  'agents',
  'recipes',
  'categories',
  'learn',
  'platforms',
  'integrations',
  'mcp',
]);
const resource = { resourceId: z.uuid(), versionId: z.uuid() };
const platform = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(40);
/** Closed vocabulary. There is deliberately no URL, query, referrer, user or free-text field. */
export const AnalyticsEventSchema = z.discriminatedUnion('event', [
  z.strictObject({ event: z.literal('page_view'), page }),
  z.strictObject({
    event: z.literal('search'),
    kind: z.enum(['all', 'agent', 'recipe', 'category', 'integration']),
    results: z.enum(['none', 'one', 'few', 'many']),
  }),
  z.strictObject({ event: z.literal('agent_view'), ...resource }),
  z.strictObject({ event: z.literal('copy_instructions'), ...resource, platform }),
  z.strictObject({ event: z.literal('platform_select'), ...resource, platform }),
  z.strictObject({ event: z.literal('definition_download'), ...resource }),
]);
export type AnalyticsEvent = z.infer<typeof AnalyticsEventSchema>;
