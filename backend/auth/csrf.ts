import { z } from 'zod';
import type { IdentityRuntime } from './runtime.ts';
import { OpaqueSchema, opaqueToken } from './contracts.ts';
import { flowCookieName, readFlowCookie, serializeFlowCookie } from './navigation.ts';
import { assertMutationOrigin, HttpFailure } from '../http/guard.ts';

const CsrfSchema = z.strictObject({ token: OpaqueSchema });
export async function csrfValue(runtime: IdentityRuntime, request: Request) {
  const name = flowCookieName('csrf', runtime.configuration.origin);
  const cookie = readFlowCookie(request, name);
  const existing = cookie
    ? CsrfSchema.safeParse(await runtime.codec.open('csrf', cookie, runtime.now()))
    : null;
  if (existing?.success) return { token: existing.data.token, cookie: null };
  return rotateCsrf(runtime);
}
export async function rotateCsrf(runtime: IdentityRuntime) {
  const token = opaqueToken();
  const cookie = await runtime.codec.seal('csrf', { token }, 3600, runtime.now());
  return {
    token,
    cookie: serializeFlowCookie(
      flowCookieName('csrf', runtime.configuration.origin),
      cookie,
      runtime.configuration.origin,
      3600,
    ),
  };
}
export async function assertCsrf(runtime: IdentityRuntime, request: Request): Promise<void> {
  assertMutationOrigin(request, runtime.configuration.origin);
  const supplied = OpaqueSchema.safeParse(request.headers.get('x-agentgrid-csrf'));
  const cookie = readFlowCookie(request, flowCookieName('csrf', runtime.configuration.origin));
  const parsed = cookie
    ? CsrfSchema.safeParse(await runtime.codec.open('csrf', cookie, runtime.now()))
    : null;
  if (
    !supplied.success ||
    !parsed?.success ||
    !(await runtime.mac.verify(
      'csrf',
      supplied.data,
      await runtime.mac.digest('csrf', parsed.data.token),
    ))
  )
    throw new HttpFailure(403, 'request-refused');
}
