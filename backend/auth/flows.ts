import { z } from 'zod';
import type { IdentityRuntime } from './runtime.ts';
import { OpaqueSchema, opaqueToken } from './contracts.ts';
import {
  flowCookieName,
  readFlowCookie,
  serializeFlowCookie,
  signInReturnPath,
} from './navigation.ts';
import { HttpFailure } from '../http/guard.ts';
import { establishSession } from './sessions.ts';

const FlowSchema = z.strictObject({
  id: OpaqueSchema,
  binding: OpaqueSchema,
  returnTo: z.string().max(89),
});
const EmailState = z.strictObject({
  email: z.email().max(254),
  tokenHash: z.string().regex(/^(?:[a-f0-9]{56}|[a-f0-9]{64})$/),
});
const GoogleState = z.strictObject({ verifier: z.string().min(20).max(256) });
export type EmailSender = (email: {
  recipient: string;
  code: string;
  expiresInMinutes: number;
  challengeId: string;
}) => Promise<unknown>;

async function newFlow(
  runtime: IdentityRuntime,
  purpose: 'email' | 'google',
  returnPath: unknown,
  state: { email: string; tokenHash: string } | { verifier: string },
  code: string | null,
) {
  const id = opaqueToken(),
    binding = opaqueToken();
  const cookiePurpose = purpose === 'email' ? 'challenge' : 'oauth';
  const lifetime = purpose === 'email' ? 300 : 600;
  await runtime.store.createFlow(
    await runtime.mac.digest('flow', id),
    purpose,
    await runtime.mac.digest('binding', binding),
    code ? await runtime.mac.digest('code', id + ':' + code) : null,
    await runtime.codec.seal(cookiePurpose, state, lifetime, runtime.now()),
  );
  const sealed = await runtime.codec.seal(
    cookiePurpose,
    { id, binding, returnTo: signInReturnPath(returnPath) },
    lifetime,
    runtime.now(),
  );
  return serializeFlowCookie(
    flowCookieName(cookiePurpose, runtime.configuration.origin),
    sealed,
    runtime.configuration.origin,
    lifetime,
  );
}

async function consume(
  runtime: IdentityRuntime,
  request: Request,
  purpose: 'email' | 'google',
  code: string | null,
) {
  const cookiePurpose = purpose === 'email' ? 'challenge' : 'oauth';
  const cookie = readFlowCookie(
    request,
    flowCookieName(cookiePurpose, runtime.configuration.origin),
  );
  const parsed = cookie
    ? FlowSchema.safeParse(await runtime.codec.open(cookiePurpose, cookie, runtime.now()))
    : null;
  if (!parsed?.success) throw new HttpFailure(401, 'verification-unavailable');
  const flow = parsed.data;
  const sealed = await runtime.store.consumeFlow(
    await runtime.mac.digest('flow', flow.id),
    purpose,
    await runtime.mac.digest('binding', flow.binding),
    code ? await runtime.mac.digest('code', flow.id + ':' + code) : null,
  );
  if (!sealed) throw new HttpFailure(401, 'verification-unavailable');
  return {
    state: await runtime.codec.open(cookiePurpose, sealed, runtime.now()),
    returnTo: signInReturnPath(flow.returnTo),
  };
}

export async function requestEmail(
  runtime: IdentityRuntime,
  email: string,
  returnTo: unknown,
  ip: string,
  send: EmailSender,
) {
  if (
    !(await runtime.store.allow(
      'email',
      await runtime.mac.digest('ip', ip),
      await runtime.mac.digest('email', email),
    ))
  )
    throw new HttpFailure(429, 'rate-limited');
  if (
    runtime.configuration.stage !== 'production' &&
    !runtime.configuration.pilotEmails.includes(email)
  )
    throw new HttpFailure(503, 'verification-unavailable');
  const challenge = await runtime.managed.emailChallenge(email);
  const cookie = await newFlow(
    runtime,
    'email',
    returnTo,
    { email, tokenHash: challenge.tokenHash },
    challenge.code,
  );
  await send({
    recipient: email,
    code: challenge.code,
    expiresInMinutes: 5,
    challengeId: crypto.randomUUID(),
  });
  return cookie;
}
export async function verifyEmail(
  runtime: IdentityRuntime,
  request: Request,
  code: string,
  ip: string,
) {
  if (!(await runtime.store.allow('verify', await runtime.mac.digest('ip', ip))))
    throw new HttpFailure(429, 'rate-limited');
  const flow = await consume(runtime, request, 'email', code);
  const parsed = EmailState.safeParse(flow.state);
  if (!parsed.success) throw new HttpFailure(401, 'verification-unavailable');
  const provider = await runtime.managed.verifyEmail(parsed.data.tokenHash);
  return {
    returnTo: flow.returnTo,
    cookie: await establishSession(runtime, request, provider, parsed.data.email),
  };
}
export async function requestGoogle(runtime: IdentityRuntime, returnTo: unknown, ip: string) {
  if (!(await runtime.store.allow('google', await runtime.mac.digest('ip', ip))))
    throw new HttpFailure(429, 'rate-limited');
  const authorization = await runtime.managed.startGoogle();
  return {
    destination: authorization.destination,
    cookie: await newFlow(runtime, 'google', returnTo, { verifier: authorization.verifier }, null),
  };
}
export async function verifyGoogle(
  runtime: IdentityRuntime,
  request: Request,
  code: string,
  ip: string,
) {
  if (!(await runtime.store.allow('verify', await runtime.mac.digest('ip', ip))))
    throw new HttpFailure(429, 'rate-limited');
  const flow = await consume(runtime, request, 'google', null);
  const parsed = GoogleState.safeParse(flow.state);
  if (!parsed.success) throw new HttpFailure(401, 'verification-unavailable');
  const provider = await runtime.managed.finishGoogle(code, parsed.data.verifier);
  return { returnTo: flow.returnTo, cookie: await establishSession(runtime, request, provider) };
}
