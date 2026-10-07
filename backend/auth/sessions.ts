import type { IdentityRuntime } from './runtime.ts';
import {
  OpaqueSchema,
  ProviderSessionSchema,
  opaqueToken,
  type ProviderSession,
} from './contracts.ts';
import { flowCookieName, readFlowCookie, serializeFlowCookie } from './navigation.ts';
import { HttpFailure } from '../http/guard.ts';

export function clearIdentityCookie(
  runtime: IdentityRuntime,
  purpose: 'session' | 'oauth' | 'challenge',
) {
  return serializeFlowCookie(
    flowCookieName(purpose, runtime.configuration.origin),
    '',
    runtime.configuration.origin,
    0,
  );
}
function allowedIdentity(runtime: IdentityRuntime, email: string): void {
  if (
    runtime.configuration.stage !== 'production' &&
    !runtime.configuration.pilotEmails.includes(email)
  )
    throw new HttpFailure(403, 'verification-unavailable');
}
async function decodeSession(runtime: IdentityRuntime, sealed: string) {
  const parsed = ProviderSessionSchema.safeParse(
    await runtime.codec.open('provider-session', sealed, runtime.now()),
  );
  if (!parsed.success) throw new HttpFailure(401, 'not-signed-in');
  return parsed.data;
}
export async function establishSession(
  runtime: IdentityRuntime,
  request: Request,
  value: ProviderSession,
  expectedEmail?: string,
) {
  const token = opaqueToken();
  const digest = await runtime.mac.digest('session', token);
  let created = false;
  try {
    const verified = await runtime.managed.verify(value);
    allowedIdentity(runtime, verified.email);
    if (expectedEmail && verified.email !== expectedEmail)
      throw new HttpFailure(401, 'verification-unavailable');
    const sealed = await runtime.codec.seal('provider-session', value, 2_592_000, runtime.now());
    if (
      !(await runtime.store.createSession(
        digest,
        await runtime.mac.digest('identity', verified.id),
        sealed,
      ))
    ) {
      throw new HttpFailure(429, 'rate-limited');
    }
    created = true;
    // Rotate the application session instead of adopting a pre-login cookie.
    const previous = readFlowCookie(
      request,
      flowCookieName('session', runtime.configuration.origin),
    );
    if (previous && OpaqueSchema.safeParse(previous).success)
      await runtime.store.revokeSession(await runtime.mac.digest('session', previous));
    return serializeFlowCookie(
      flowCookieName('session', runtime.configuration.origin),
      token,
      runtime.configuration.origin,
      2_592_000,
    );
  } catch (error) {
    if (created) await runtime.store.revokeSession(digest).catch(() => {});
    await runtime.managed.signOut(value).catch(() => {});
    throw error;
  }
}

export async function authenticatedSession(runtime: IdentityRuntime, request: Request) {
  const token = readFlowCookie(request, flowCookieName('session', runtime.configuration.origin));
  if (!OpaqueSchema.safeParse(token).success) throw new HttpFailure(401, 'not-signed-in');
  const digest = await runtime.mac.digest('session', token!);
  const record = await runtime.store.loadSession(digest);
  if (!record || record.expiresAt <= runtime.now()) throw new HttpFailure(401, 'not-signed-in');
  let provider = await decodeSession(runtime, record.encryptedState);
  if (provider.expiresAt <= runtime.now() + 30) {
    let refreshed: ProviderSession;
    try {
      refreshed = await runtime.managed.refresh(provider.refreshToken);
    } catch (error) {
      // Concurrent refresh may already have rotated the shared provider token.
      const latest = await runtime.store.loadSession(digest);
      if (!latest || latest.revision === record.revision) throw error;
      provider = await decodeSession(runtime, latest.encryptedState);
      refreshed = provider;
    }
    if (refreshed.subject !== provider.subject) throw new HttpFailure(401, 'not-signed-in');
    const remaining = Math.min(2_592_000, record.expiresAt - runtime.now());
    if (remaining < 1) throw new HttpFailure(401, 'not-signed-in');
    const sealed = await runtime.codec.seal(
      'provider-session',
      refreshed,
      remaining,
      runtime.now(),
    );
    if (await runtime.store.replaceSession(digest, record.revision, sealed)) provider = refreshed;
    else {
      const latest = await runtime.store.loadSession(digest);
      if (!latest) throw new HttpFailure(401, 'not-signed-in');
      provider = await decodeSession(runtime, latest.encryptedState);
    }
  }
  const identity = await runtime.managed.verify(provider);
  allowedIdentity(runtime, identity.email);
  return { identity, provider, digest };
}

export async function endSession(runtime: IdentityRuntime, request: Request): Promise<void> {
  let active: Awaited<ReturnType<typeof authenticatedSession>> | null = null;
  try {
    active = await authenticatedSession(runtime, request);
  } catch (error) {
    if (!(error instanceof HttpFailure) || error.status !== 401) throw error;
  }
  const cookie = readFlowCookie(request, flowCookieName('session', runtime.configuration.origin));
  if (cookie && OpaqueSchema.safeParse(cookie).success)
    await runtime.store.revokeSession(await runtime.mac.digest('session', cookie));
  if (active) await runtime.managed.signOut(active.provider);
}
