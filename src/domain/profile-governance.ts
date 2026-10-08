import { z } from 'zod';
import { ProfileSchema } from './workspace.ts';
export const AdminProfileSchema = ProfileSchema.extend({
  revision: z.int().min(1).max(2147483647),
  roles: z
    .array(z.enum(['moderator', 'administrator']))
    .max(2)
    .refine((roles) => new Set(roles).size === roles.length),
  isSelf: z.boolean(),
  linked: z.boolean(),
});
export type AdminProfile = z.infer<typeof AdminProfileSchema>;
export const ProfileDecisionSchema = z.strictObject({
  profileId: z.uuid(),
  expectedRevision: z.int().min(1).max(2147483646),
  decision: z.enum([
    'suspend',
    'restore',
    'grant-moderator',
    'revoke-moderator',
    'grant-administrator',
    'revoke-administrator',
  ]),
  explanation: z.string().trim().min(20).max(2360),
});
export type ProfileDecision = z.infer<typeof ProfileDecisionSchema>;
export const profileDecisionLabels: Record<ProfileDecision['decision'], string> = {
  suspend: 'Suspend AgentGrid access',
  restore: 'Restore AgentGrid access',
  'grant-moderator': 'Grant moderator role',
  'revoke-moderator': 'Revoke moderator role',
  'grant-administrator': 'Grant administrator role',
  'revoke-administrator': 'Revoke administrator role',
};
export function availableProfileDecisions(profile: AdminProfile): ProfileDecision['decision'][] {
  if (!profile.linked || profile.status === 'deactivated') return [];
  if (profile.status === 'suspended') return ['restore'];
  return [
    'suspend',
    profile.roles.includes('moderator') ? 'revoke-moderator' : 'grant-moderator',
    profile.roles.includes('administrator') ? 'revoke-administrator' : 'grant-administrator',
  ];
}
