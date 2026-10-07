import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sendSignInEmail } from '../backend/email/resend.ts';
import { validateEnvironment } from './verify-environment.mjs';

// Deliberate live integration check. Never invoke from CI or public HTTP routes.
// The alias belongs to the owner's approved personal mailbox. No creator profile,
// public activity, application data, or existing auth user is fabricated/modified.
const recipient = 'devujjwal1989+agentgrid-test@gmail.com';

async function main() {
  if (process.argv.length !== 3 || process.argv[2] !== '--send-owner-test') {
    throw new Error('Live validation requires the explicit --send-owner-test flag.');
  }
  if (process.env.CI) throw new Error('Live owner delivery validation is forbidden in CI.');
  if (validateEnvironment(process.env).length) throw new Error('Invalid public configuration.');
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://lxecbrvzpmgjmsqiachc.supabase.co' ||
    !process.env.SUPABASE_SECRET_KEY?.startsWith('sb_secret_') ||
    !process.env.RESEND_API_KEY ||
    !process.env.RESEND_FROM_EMAIL
  ) {
    throw new Error('Expected isolated local provider configuration is missing.');
  }
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(15_000) }),
    },
  };
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    options,
  );
  const publicClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    options,
  );
  const generated = await admin.auth.admin.generateLink({ type: 'magiclink', email: recipient });
  if (generated.error || !generated.data.properties?.email_otp) {
    throw new Error('Supabase OTP generation failed; no provider response was logged.');
  }
  const token = generated.data.properties.email_otp;
  const receipt = await sendSignInEmail(
    { apiKey: process.env.RESEND_API_KEY, fromEmail: process.env.RESEND_FROM_EMAIL },
    { recipient, code: token, expiresInMinutes: 60, challengeId: randomUUID() },
  );
  console.log('AgentGrid email accepted by Resend; receipt: ' + receipt.receiptId);
  // This validates provider interoperability, not inbox placement or the future
  // challenge-bound application flow. Shared Supabase OTP expiry remains 1 hour.
  const verified = await publicClient.auth.verifyOtp({ email: recipient, token, type: 'email' });
  if (verified.error || !verified.data.session || verified.data.user?.email !== recipient) {
    throw new Error('Real Supabase OTP verification failed; no session was logged.');
  }
  let logoutFailed;
  try {
    const replay = await publicClient.auth.verifyOtp({ email: recipient, token, type: 'email' });
    if (!replay.error || replay.data.session)
      throw new Error('Consumed OTP unexpectedly accepted twice.');
  } finally {
    const logout = await publicClient.auth.signOut({ scope: 'local' });
    logoutFailed = Boolean(logout.error);
  }
  if (logoutFailed) throw new Error('Test session local sign-out failed.');
  console.log('Real OTP verification, replay rejection, and local-only sign-out passed.');
  console.log(
    'Inbox delivery and application-level expiry/abuse protections require separate validation.',
  );
}

main().catch((error) => {
  // Never serialize provider errors, generated properties, codes or sessions.
  console.error(
    error instanceof Error && error.message.startsWith('AgentGrid email delivery:')
      ? error.message
      : 'Live auth validation did not complete. Inspect the sanitized test checkpoints.',
  );
  process.exitCode = 1;
});
