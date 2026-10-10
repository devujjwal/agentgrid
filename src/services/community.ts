import { z } from 'zod';

const messages: Record<string, string> = {
  'not-found': 'This resource is unavailable for your account. Open it from your workspace.',
  'request-too-large': 'This request is too large. Reduce the content and try again.',
  'request-refused': 'This request could not be verified. Refresh the page and try again.',
  'invalid-request': 'Check the fields and try again.',
  'not-signed-in': 'Your session has ended. Sign in again to continue.',
  'verification-unavailable':
    'Verification did not complete. Request a new code or try Google again.',
  'rate-limited': 'Too many attempts. Please wait before trying again.',
  conflict: 'This information changed, or the username is taken. Reload before continuing.',
  'definition-incomplete':
    'Check definition readiness and select explicit use terms before submitting.',
  'terms-required': 'Current community terms are required. Refresh before joining.',
};
export class CommunityError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(messages[code] ?? 'AgentGrid is temporarily unavailable. Please try again.');
    this.code = code;
  }
}
/** Private data is never stored in localStorage or a global cache. No provider
 * token, raw error, redirects, credentials or cross-origin request is accepted.
 */
export async function communityRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  mutation?: { csrf: string; body: unknown },
  signal?: AbortSignal,
): Promise<T> {
  const creatorPath =
    /^\/api\/(?:identity|workspace)\/(?:[a-z]+\/)?(?:\?offset=\d{1,4}|\?resourceId=[a-fA-F0-9-]{36}(?:&offset=\d{1,4}|&versionId=[a-fA-F0-9-]{36})?)?$/.test(
      path,
    );
  const staffPath =
    /^\/api\/moderation\/(?:release-requests\/\?versionId=[a-fA-F0-9-]{36}|release-request\/|release-cancel\/|host-record\/\?recordId=[a-fA-F0-9-]{36}|host-runs\/\?versionId=[a-fA-F0-9-]{36}|host-run\/|resource\/\?resourceId=[a-fA-F0-9-]{36}|resource-decision\/|reviews\/\?state=(?:pending|published|hidden)&offset=\d{1,4}|review\/\?reviewId=[a-fA-F0-9-]{36}|reports\/\?state=(?:open|resolved|dismissed)&offset=\d{1,4}|report\/\?reportId=[a-fA-F0-9-]{36}|submissions\/\?state=(?:pending|approved|rejected|withdrawn)&offset=\d{1,4}|submission\/\?versionId=[a-fA-F0-9-]{36}|rejection\/|decision\/|resolution\/)$/.test(
      path,
    );
  if (
    !/^\/api\/execution\/(?:prepare\/|approve\/|cancel\/)?$/.test(path) &&
    !creatorPath &&
    !staffPath &&
    !/^\/api\/admin\/(?:profile\/\?username=[a-z][a-z0-9_]{2,29}|profile-decision\/|publication\/)$/.test(
      path,
    ) &&
    !/^\/api\/workspace\/forksource\/\?sourceVersionId=[a-fA-F0-9-]{36}$/.test(path)
  )
    throw new CommunityError('request-refused');
  let response: Response;
  try {
    response = await fetch(path, {
      method: mutation ? 'POST' : 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(35_000)])
        : AbortSignal.timeout(35_000),
      ...(mutation
        ? {
            headers: { 'Content-Type': 'application/json', 'X-AgentGrid-CSRF': mutation.csrf },
            body: JSON.stringify(mutation.body),
          }
        : {}),
    });
  } catch {
    throw new CommunityError('service-unavailable');
  }
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new CommunityError('service-unavailable');
  }
  if (!response.ok) {
    const failure = z.strictObject({ error: z.string().max(60) }).safeParse(value);
    throw new CommunityError(failure.success ? failure.data.error : 'service-unavailable');
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new CommunityError('service-unavailable');
  return parsed.data;
}
