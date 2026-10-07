import { z } from 'zod';

export const ProfileSchema = z.strictObject({
  id: z.uuid(),
  username: z.string().regex(/^[a-z][a-z0-9_]{2,29}$/),
  displayName: z.string().min(2).max(80),
  bio: z.string().max(1600),
  website: z.url().nullable(),
  visibility: z.enum(['private', 'public']),
  status: z.enum(['active', 'suspended', 'deactivated']),
});
export const WorkspaceIdentitySchema = z.strictObject({
  profile: ProfileSchema.nullable(),
  roles: z.array(z.enum(['moderator', 'administrator'])).max(2),
  onboarding: z.strictObject({
    enabled: z.boolean(),
    termsVersion: z.string().max(40).nullable(),
    privacyVersion: z.string().max(40).nullable(),
  }),
});
export type WorkspaceIdentity = z.infer<typeof WorkspaceIdentitySchema>;
export const ProfileInputSchema = z.strictObject({
  displayName: z.string().trim().min(2).max(80),
  bio: z.string().max(1600),
  website: z.union([
    z.literal(''),
    z
      .url()
      .max(2048)
      .refine((value) => {
        const url = new URL(value);
        return url.protocol === 'https:' && !url.username && !url.password;
      }),
  ]),
});
export const OnboardingInputSchema = z.strictObject({
  username: z
    .string()
    .regex(/^[a-z][a-z0-9_]{2,29}$/)
    .refine((value) => !value.startsWith('u_')),
  displayName: z.string().trim().min(2).max(80),
  termsVersion: z.string().min(1).max(40),
  privacyVersion: z.string().min(1).max(40),
  acceptsTerms: z.literal(true),
  acknowledgesPrivacy: z.literal(true),
});
export const WorkspaceAgentSchema = z.strictObject({
  id: z.uuid(),
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(80),
  status: z.enum(['active', 'blocked', 'archived']),
  createdAt: z.iso.datetime({ offset: true }),
});
export const WorkspaceListSchema = z.strictObject({
  agents: z.array(WorkspaceAgentSchema).max(20),
  hasMore: z.boolean(),
  offset: z.int().min(0).max(9999),
});
export type WorkspaceList = z.infer<typeof WorkspaceListSchema>;
