import { z } from 'zod';
export const CreatorUsernameSchema = z.string().regex(/^[a-z][a-z0-9_]{2,29}$/);
export const CreatorAgentSchema = z.strictObject({
  id: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  name: z.string().min(1).max(120),
  summary: z.string().min(1).max(500),
  category: z
    .string()
    .regex(/^[a-z][a-z-]*$/)
    .max(40),
  version: z
    .string()
    .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
    .max(24),
  releasedAt: z.iso.datetime({ offset: true }),
});
export const CreatorProjectionSchema = z
  .strictObject({
    id: z.uuid(),
    username: CreatorUsernameSchema,
    displayName: z.string().min(2).max(100),
    bio: z.string().max(1600),
    website: z.string().max(2048).nullable(),
    kind: z.enum(['first-party', 'community']),
    agents: z.array(CreatorAgentSchema).max(21),
  })
  .refine((value) => new Set(value.agents.map((agent) => agent.id)).size === value.agents.length)
  .refine((value) => value.kind !== 'first-party' || value.displayName === 'AgentGrid Editorial');
export const PublicCreatorSchema = CreatorProjectionSchema.safeExtend({
  agents: z.array(CreatorAgentSchema).max(20),
  offset: z
    .int()
    .min(0)
    .max(9980)
    .refine((value) => value % 20 === 0),
  hasMore: z.boolean(),
});
export type PublicCreator = z.infer<typeof PublicCreatorSchema>;
export function creatorPath(username: string) {
  return `/creators/${CreatorUsernameSchema.parse(username)}/`;
}
/** Legacy profile URLs are untrusted; only credential-free HTTPS links render. */
export function safeCreatorWebsite(value: string | null): string | null {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
