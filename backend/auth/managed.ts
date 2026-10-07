import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthConfiguration } from './configuration.ts';
import {
  IdentitySchema,
  ProviderSessionSchema,
  type ManagedIdentity,
  type ProviderSession,
} from './contracts.ts';
import { HttpFailure } from '../http/guard.ts';

const storageKey = 'agentgrid_identity';
function providerFailure(
  error: { status?: number | undefined },
  code: 'not-signed-in' | 'verification-unavailable',
) {
  return error.status && error.status >= 400 && error.status < 500
    ? new HttpFailure(401, code)
    : new HttpFailure(503, 'service-unavailable');
}
export function managedIdentity(
  configuration: AuthConfiguration,
  transport: typeof fetch = fetch,
): ManagedIdentity {
  const safeFetch: typeof fetch = (input, init) =>
    transport(input, {
      ...init,
      redirect: 'error',
      signal: AbortSignal.timeout(15_000),
    });
  const client = (privileged = false, storage = new Map<string, string>()): SupabaseClient =>
    createClient(
      configuration.supabaseOrigin,
      privileged ? configuration.secretKey : configuration.publishableKey,
      {
        auth: {
          storageKey,
          flowType: 'pkce',
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: true,
          storage: {
            getItem: (key) => storage.get(key) ?? null,
            setItem: (key, value) => {
              storage.set(key, value);
            },
            removeItem: (key) => {
              storage.delete(key);
            },
          },
        },
        global: { fetch: safeFetch },
      },
    );
  function session(value: Session | null): ProviderSession {
    const parsed = ProviderSessionSchema.safeParse({
      subject: value?.user.id,
      accessToken: value?.access_token,
      refreshToken: value?.refresh_token,
      expiresAt: value?.expires_at,
    });
    if (!parsed.success) throw new HttpFailure(401, 'verification-unavailable');
    return parsed.data;
  }
  return {
    async emailChallenge(email) {
      const result = await client(true).auth.admin.generateLink({ type: 'magiclink', email });
      if (
        result.error ||
        !/^\d{6,10}$/.test(result.data.properties.email_otp) ||
        !/^[a-f0-9]{64}$/.test(result.data.properties.hashed_token)
      )
        throw new HttpFailure(503, 'verification-unavailable');
      return {
        code: result.data.properties.email_otp,
        tokenHash: result.data.properties.hashed_token,
      };
    },
    async verifyEmail(tokenHash) {
      const result = await client().auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
      if (result.error) throw providerFailure(result.error, 'verification-unavailable');
      return session(result.data.session);
    },
    async startGoogle() {
      const storage = new Map<string, string>();
      const result = await client(false, storage).auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: configuration.origin + '/auth/callback/',
          skipBrowserRedirect: true,
          scopes: 'openid email profile',
        },
      });
      const destination = result.data.url ? new URL(result.data.url) : null;
      const verifier = storage.get(storageKey + '-code-verifier');
      if (
        result.error ||
        !destination ||
        destination.origin !== configuration.supabaseOrigin ||
        destination.pathname !== '/auth/v1/authorize' ||
        !verifier ||
        verifier.length > 256
      )
        throw new HttpFailure(503, 'verification-unavailable');
      return { destination: destination.href, verifier };
    },
    async finishGoogle(code, verifier) {
      const storage = new Map([[storageKey + '-code-verifier', verifier]]);
      const result = await client(false, storage).auth.exchangeCodeForSession(code);
      if (result.error) throw providerFailure(result.error, 'verification-unavailable');
      if (!result.data.session?.user.identities?.some((identity) => identity.provider === 'google'))
        throw new HttpFailure(401, 'verification-unavailable');
      return session(result.data.session);
    },
    async refresh(refreshToken) {
      const result = await client().auth.refreshSession({ refresh_token: refreshToken });
      if (result.error) throw providerFailure(result.error, 'not-signed-in');
      return session(result.data.session);
    },
    async verify(value) {
      // Remote getUser validates identity; decoded JWTs/session user metadata do not.
      const result = await client().auth.getUser(value.accessToken);
      if (result.error) throw providerFailure(result.error, 'not-signed-in');
      const parsed = IdentitySchema.safeParse({
        id: result.data.user?.id,
        email: result.data.user?.email?.toLowerCase(),
      });
      if (
        !parsed.success ||
        !result.data.user?.email_confirmed_at ||
        parsed.data.id !== value.subject
      )
        throw new HttpFailure(401, 'not-signed-in');
      return parsed.data;
    },
    async signOut(value) {
      // Scope local revokes only this managed session, preserving other apps.
      const result = await client().auth.admin.signOut(value.accessToken, 'local');
      if (result.error) throw new HttpFailure(503, 'service-unavailable');
    },
  };
}
