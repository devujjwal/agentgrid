import { z } from 'zod';
export const IdentityResponseSchema = z.discriminatedUnion('signedIn', [
  z.strictObject({ signedIn: z.literal(false), csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }),
  z.strictObject({
    signedIn: z.literal(true),
    csrf: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    email: z.email().max(254),
  }),
]);
export type IdentityResponse = z.infer<typeof IdentityResponseSchema>;
export function signInReturnPath(value: unknown): string {
  if (typeof value !== 'string') return '/workspace/';
  if (
    value === '/workspace/' ||
    value === '/workspace/account/' ||
    value === '/saves/' ||
    value === '/workspace/reports/' ||
    value === '/workspace/moderation/' ||
    value === '/workspace/moderation/people/' ||
    value === '/workspace/moderation/reports/' ||
    value === '/workspace/moderation/submissions/' ||
    value === '/workspace/moderation/agent/'
  )
    return value;
  if (
    /^\/workspace\/moderation\/agent\/\?resourceId=[a-fA-F0-9-]{36}$/.test(value) &&
    z.uuid().safeParse(value.split('=')[1]).success
  )
    return value;
  if (
    value === '/workspace/agent/' ||
    /^\/workspace\/(?:agent|versions)\/\?resourceId=[a-fA-F0-9-]{36}$/.test(value)
  ) {
    if (value === '/workspace/agent/') return value;
    const id = z.uuid().safeParse(value.split('=')[1]);
    if (id.success) return value;
  }
  if (
    /^\/workspace\/fork\/\?sourceVersionId=[a-fA-F0-9-]{36}$/.test(value) &&
    z.uuid().safeParse(value.split('=')[1]).success
  )
    return value;
  if (/^\/agents\/[a-z0-9]+(?:-[a-z0-9]+)*\/$/.test(value) && value.length <= 89) return value;
  return '/workspace/';
}
