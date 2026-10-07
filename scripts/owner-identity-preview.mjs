/** Owner-only real-provider acceptance. Loopback only, never a deployed server.
 * No global/shared logout, credential creation, profile seeding or terms consent.
 */
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { authConfiguration } from '../backend/auth/configuration.ts';
import { identityRuntime } from '../backend/auth/runtime.ts';
import { identityStore } from '../backend/auth/store.ts';
import { managedIdentity } from '../backend/auth/managed.ts';
import { identityHandler } from '../backend/http/identity.ts';
import { workspaceHandler } from '../backend/http/workspace.ts';
import { workspaceData } from '../backend/workspace/data.ts';
import { sendSignInEmail } from '../backend/email/resend.ts';
import { privateFailure } from '../backend/http/guard.ts';

export async function ownerIdentityPreview() {
  if (process.env.CI || process.env.GITHUB_ACTIONS || !process.argv.includes('--owner-live-auth'))
    throw new Error('Explicit local owner identity acceptance required.');
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://lxecbrvzpmgjmsqiachc.supabase.co')
    throw new Error('Approved shared acceptance project required.');
  const configuration = authConfiguration({
    ...process.env,
    AGENTGRID_STAGE: 'development',
    AGENTGRID_ORIGIN: 'http://localhost:3027',
    AGENTGRID_PILOT_EMAILS: 'devujjwal1989@gmail.com',
    AGENTGRID_ENVELOPE_KEYS: JSON.stringify([
      { id: 'ephemeral', material: randomBytes(32).toString('base64url') },
    ]),
    AGENTGRID_RATE_KEY: randomBytes(32).toString('base64url'),
  });
  const store = identityStore(configuration),
    managed = managedIdentity(configuration);
  const ownedSessions = new Set(),
    ownedProviders = new Map();
  const create = store.createSession,
    revoke = store.revokeSession,
    signOut = managed.signOut;
  store.createSession = async (...parameters) => {
    const result = await create(...parameters);
    if (result) ownedSessions.add(parameters[0]);
    return result;
  };
  store.revokeSession = async (digest) => {
    await revoke(digest);
    ownedSessions.delete(digest);
  };
  for (const name of ['verifyEmail', 'finishGoogle', 'refresh']) {
    const action = managed[name];
    managed[name] = async (...parameters) => {
      const session = await action(...parameters);
      ownedProviders.set(session.accessToken, session);
      return session;
    };
  }
  managed.signOut = async (session) => {
    await signOut(session);
    ownedProviders.delete(session.accessToken);
  };
  const runtime = await identityRuntime(configuration, store, managed);
  const identity = identityHandler(runtime, (email) =>
    sendSignInEmail({ apiKey: configuration.resendKey, fromEmail: configuration.fromEmail }, email),
  );
  const workspace = workspaceHandler(runtime, (session) => workspaceData(configuration, session));
  return {
    async request(incoming, outgoing) {
      try {
        if (incoming.headers.host !== 'localhost:3027') {
          outgoing
            .writeHead(403, {
              'Cache-Control': 'private, no-store',
              'X-Robots-Tag': 'noindex,nofollow',
            })
            .end();
          return;
        }
        const headers = new Headers();
        for (const [key, value] of Object.entries(incoming.headers))
          if (value !== undefined)
            headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        const request = new Request(configuration.origin + incoming.url, {
          method: incoming.method,
          headers,
          ...(['GET', 'HEAD'].includes(incoming.method)
            ? {}
            : { body: Readable.toWeb(incoming), duplex: 'half' }),
        });
        const result = incoming.url.startsWith('/api/workspace/')
          ? await workspace(request)
          : await identity(request, '127.0.0.1');
        for (const [key, value] of result.headers)
          if (key !== 'set-cookie') outgoing.setHeader(key, value);
        const cookies = result.headers.getSetCookie();
        if (cookies.length) outgoing.setHeader('Set-Cookie', cookies);
        outgoing.writeHead(result.status).end(Buffer.from(await result.arrayBuffer()));
      } catch (error) {
        const result = privateFailure(error);
        outgoing
          .writeHead(result.status, Object.fromEntries(result.headers))
          .end(await result.text());
      }
    },
    async close() {
      // Only this process's opaque, generated records and newly minted sessions.
      // Never a profile/Auth user deletion or another application's session.
      let failed = false;
      for (const digest of ownedSessions)
        await revoke(digest).catch(() => {
          failed = true;
        });
      for (const session of ownedProviders.values())
        await signOut(session).catch(() => {
          failed = true;
        });
      if (failed)
        console.warn(
          'Owner acceptance session cleanup was incomplete; application state remains expiry-bound.',
        );
    },
  };
}
