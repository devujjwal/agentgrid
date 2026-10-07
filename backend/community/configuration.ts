import { z } from 'zod';

const Configuration = z
  .strictObject({
    stage: z.enum(['development', 'preview', 'production']),
    origin: z.url(),
    supabaseOrigin: z.url(),
    publishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{20,}$/),
  })
  .superRefine((value, context) => {
    const approved = {
      development: 'http://localhost:3027',
      preview: 'https://agentgrid-staging.pages.dev',
      production: 'https://agentgrid.me',
    };
    if (value.origin !== approved[value.stage])
      context.addIssue({ code: 'custom', message: 'Unapproved application origin.' });
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(value.supabaseOrigin))
      context.addIssue({ code: 'custom', message: 'Unapproved public data origin.' });
  });
/** Public community reads require no privileged identity/email credentials. */
export function publicCommunityConfiguration(environment: Record<string, unknown>) {
  const parsed = Configuration.safeParse({
    stage: environment.AGENTGRID_STAGE,
    origin: environment.AGENTGRID_ORIGIN,
    supabaseOrigin: environment.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  if (!parsed.success) throw new Error('Public community configuration is unavailable.');
  return parsed.data;
}
