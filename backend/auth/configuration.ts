import { z } from 'zod';
import type { EnvelopeKey } from '../security/envelope.ts';

const KeySchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9_-]{1,16}$/),
  material: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
const ConfigurationSchema = z
  .strictObject({
    stage: z.enum(['development', 'preview', 'production']),
    origin: z.url(),
    supabaseOrigin: z.url(),
    publishableKey: z.string().regex(/^sb_publishable_[A-Za-z0-9_-]{20,}$/),
    secretKey: z.string().regex(/^sb_secret_[A-Za-z0-9_-]{20,}$/),
    resendKey: z.string().regex(/^re_[A-Za-z0-9_-]{20,}$/),
    fromEmail: z.string().regex(/^[A-Za-z0-9._+-]+@mail\.agentgrid\.me$/),
    envelopeKeys: z.array(KeySchema).min(1).max(2),
    rateKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    pilotEmails: z.array(z.email().max(254)).max(8),
  })
  .superRefine((configuration, context) => {
    const allowed = {
      development: 'http://localhost:3027',
      preview: 'https://agentgrid-staging.pages.dev',
      production: 'https://agentgrid.me',
    };
    if (configuration.origin !== allowed[configuration.stage])
      context.addIssue({ code: 'custom', message: 'Unapproved application origin.' });
    const supabase = new URL(configuration.supabaseOrigin);
    if (
      supabase.protocol !== 'https:' ||
      !/^[a-z0-9]+\.supabase\.co$/.test(supabase.hostname) ||
      supabase.origin !== configuration.supabaseOrigin ||
      supabase.username ||
      supabase.password
    )
      context.addIssue({ code: 'custom', message: 'Unapproved managed identity origin.' });
    if (
      new Set(configuration.envelopeKeys.map((key) => key.id)).size !==
      configuration.envelopeKeys.length
    )
      context.addIssue({ code: 'custom', message: 'Duplicate private key identifier.' });
    if (configuration.stage !== 'production' && configuration.pilotEmails.length === 0)
      context.addIssue({
        code: 'custom',
        message: 'Non-production identity requires an owner pilot allowlist.',
      });
    if (configuration.stage === 'production' && configuration.pilotEmails.length > 0)
      context.addIssue({
        code: 'custom',
        message: 'Production identity must not silently inherit a pilot restriction.',
      });
  });
export type AuthConfiguration = z.infer<typeof ConfigurationSchema> & {
  envelopeKeys: EnvelopeKey[];
};

/** Explicitly select environment fields; never return/log raw provider binding
 * objects or Zod failures, which can include private values.
 */
export function authConfiguration(environment: Record<string, unknown>): AuthConfiguration {
  try {
    return ConfigurationSchema.parse({
      stage: environment.AGENTGRID_STAGE,
      origin: environment.AGENTGRID_ORIGIN,
      supabaseOrigin: environment.NEXT_PUBLIC_SUPABASE_URL,
      publishableKey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      secretKey: environment.SUPABASE_SECRET_KEY,
      resendKey: environment.RESEND_API_KEY,
      fromEmail: environment.RESEND_FROM_EMAIL,
      envelopeKeys: JSON.parse(String(environment.AGENTGRID_ENVELOPE_KEYS)),
      rateKey: environment.AGENTGRID_RATE_KEY,
      pilotEmails: String(environment.AGENTGRID_PILOT_EMAILS ?? '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    });
  } catch {
    throw new Error('AgentGrid server configuration is unavailable.');
  }
}
