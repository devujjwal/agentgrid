import { z } from 'zod';
import type { IdentityRuntime } from '../auth/runtime.ts';
import { csrfValue, assertCsrf, rotateCsrf } from '../auth/csrf.ts';
import {
  requestEmail,
  verifyEmail,
  requestGoogle,
  verifyGoogle,
  type EmailSender,
} from '../auth/flows.ts';
import { authenticatedSession, endSession, clearIdentityCookie } from '../auth/sessions.ts';
import {
  assertRequestTarget,
  HttpFailure,
  privateJson,
  privateFailure,
  readJsonBody,
} from './guard.ts';

const EmailRequest = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  returnTo: z.string().max(89).optional(),
});
const CodeRequest = z.strictObject({ code: z.string().regex(/^\d{6,10}$/) });
const GoogleRequest = z.strictObject({ returnTo: z.string().max(89).optional() });
const EmptyRequest = z.strictObject({});

async function input<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await readJsonBody(request, 2048));
  if (!parsed.success) throw new HttpFailure(400, 'invalid-request');
  return parsed.data;
}
function cookies(response: Response, values: (string | null)[]): Response {
  for (const cookie of values) if (cookie) response.headers.append('Set-Cookie', cookie);
  return response;
}
function redirect(path: string, values: (string | null)[] = []): Response {
  const response = privateJson(null, 303);
  response.headers.set('Location', path);
  return cookies(response, values);
}

/** clientIp is supplied by the Cloudflare runtime wrapper, never JSON, forwarded
 * headers or a caller-selected role/identifier. Local harness supplies loopback.
 */
export function identityHandler(runtime: IdentityRuntime, send: EmailSender) {
  return async (request: Request, clientIp: string): Promise<Response> => {
    const url = new URL(request.url);
    const callback = url.pathname === '/auth/callback/';
    try {
      assertRequestTarget(request, runtime.configuration.origin);
      if (!clientIp || clientIp.length > 64 || !/^[a-fA-F0-9:.]+$/.test(clientIp))
        throw new HttpFailure(503, 'service-unavailable');
      if (callback) {
        if (request.method !== 'GET') throw new HttpFailure(405, 'method-unavailable');
        const code = url.searchParams.get('code');
        if (
          !code ||
          code.length > 2048 ||
          url.searchParams.getAll('code').length !== 1 ||
          url.searchParams.has('error') ||
          url.searchParams.has('error_description')
        )
          throw new HttpFailure(401, 'verification-unavailable');
        const session = await verifyGoogle(runtime, request, code, clientIp);
        const csrf = await rotateCsrf(runtime);
        return redirect(session.returnTo, [
          session.cookie,
          csrf.cookie,
          clearIdentityCookie(runtime, 'oauth'),
          clearIdentityCookie(runtime, 'challenge'),
        ]);
      }
      if (url.search) throw new HttpFailure(400, 'invalid-request');
      if (url.pathname === '/api/identity/' && request.method === 'GET') {
        if (
          request.headers.has('sec-fetch-site') &&
          request.headers.get('sec-fetch-site') !== 'same-origin'
        )
          throw new HttpFailure(403, 'request-refused');
        const csrf = await csrfValue(runtime, request);
        try {
          const session = await authenticatedSession(runtime, request);
          return cookies(
            privateJson({ csrf: csrf.token, signedIn: true, email: session.identity.email }),
            [csrf.cookie],
          );
        } catch (error) {
          if (!(error instanceof HttpFailure) || error.status !== 401) throw error;
          return cookies(privateJson({ csrf: csrf.token, signedIn: false }), [
            csrf.cookie,
            clearIdentityCookie(runtime, 'session'),
          ]);
        }
      }
      const paths = [
        '/api/identity/email/',
        '/api/identity/verify/',
        '/api/identity/google/',
        '/api/identity/logout/',
      ];
      if (!paths.includes(url.pathname)) throw new HttpFailure(404, 'not-found');
      await assertCsrf(runtime, request);
      if (url.pathname.endsWith('/email/')) {
        const data = await input(request, EmailRequest);
        const cookie = await requestEmail(runtime, data.email, data.returnTo, clientIp, send);
        return cookies(privateJson({ challenge: 'sent', expiresInSeconds: 300 }), [cookie]);
      }
      if (url.pathname.endsWith('/google/')) {
        const data = await input(request, GoogleRequest);
        const flow = await requestGoogle(runtime, data.returnTo, clientIp);
        return cookies(privateJson({ destination: flow.destination }), [flow.cookie]);
      }
      if (url.pathname.endsWith('/verify/')) {
        const data = await input(request, CodeRequest);
        const session = await verifyEmail(runtime, request, data.code, clientIp);
        const csrf = await rotateCsrf(runtime);
        return cookies(
          privateJson({ signedIn: true, returnTo: session.returnTo, csrf: csrf.token }),
          [
            session.cookie,
            csrf.cookie,
            clearIdentityCookie(runtime, 'challenge'),
            clearIdentityCookie(runtime, 'oauth'),
          ],
        );
      }
      await input(request, EmptyRequest);
      await endSession(runtime, request);
      const csrf = await rotateCsrf(runtime);
      return cookies(privateJson({ signedIn: false, csrf: csrf.token }), [
        csrf.cookie,
        clearIdentityCookie(runtime, 'session'),
        clearIdentityCookie(runtime, 'challenge'),
        clearIdentityCookie(runtime, 'oauth'),
      ]);
    } catch (error) {
      if (callback && url.origin === runtime.configuration.origin)
        return redirect('/sign-in/?notice=verification-unavailable', [
          clearIdentityCookie(runtime, 'oauth'),
        ]);
      return privateFailure(error);
    }
  };
}
