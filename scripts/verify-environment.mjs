import { resolve } from 'node:path';

const publicAllowlist = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
]);

export function validateEnvironment(env) {
  const errors = [];
  for (const key of Object.keys(env)) {
    if (key.startsWith('NEXT_PUBLIC_') && !publicAllowlist.has(key)) {
      errors.push(`Unapproved public environment variable: ${key}`);
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publicKey) errors.push('Supabase public URL and publishable key are required.');
  if (url) {
    try {
      const parsed = new URL(url);
      if (
        parsed.protocol !== 'https:' ||
        !parsed.hostname.endsWith('.supabase.co') ||
        parsed.username ||
        parsed.password ||
        parsed.pathname !== '/' ||
        parsed.search ||
        parsed.hash
      ) {
        errors.push('Production Supabase URL must be an HTTPS Supabase project origin.');
      }
    } catch {
      errors.push('Invalid Supabase URL.');
    }
  }
  if (publicKey && !publicKey.startsWith('sb_publishable_')) {
    errors.push('Use a Supabase publishable key; legacy or secret keys are not accepted here.');
  }
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const errors = validateEnvironment(process.env);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Public environment boundary verified.');
}
