import { z } from 'zod';
export const DeactivateAccountSchema = z.strictObject({
  profileId: z.uuid(),
  username: z.string().regex(/^[a-z][a-z0-9_]{2,29}$/),
  understandsRemoval: z.literal(true),
});
export const DeactivatedAccountSchema = z.strictObject({
  profileId: z.uuid(),
  deactivated: z.literal(true),
});
export type DeactivateAccount = z.infer<typeof DeactivateAccountSchema>;
