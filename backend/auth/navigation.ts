export { signInReturnPath } from '../../src/domain/session.ts';

export function flowCookieName(
  purpose: 'csrf' | 'oauth' | 'challenge' | 'session',
  origin: string,
): string {
  const prefix = new URL(origin).protocol === 'https:' ? '__Host-agentgrid_' : 'agentgrid_local_';
  return `${prefix}${purpose}`;
}

export function readFlowCookie(request: Request, name: string): string | null {
  if (!/^(?:__Host-agentgrid_|agentgrid_local_)(?:csrf|oauth|challenge|session)$/.test(name))
    return null;
  const header = request.headers.get('cookie') ?? '';
  if (header.length > 16_384) return null;
  const found = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(name + '='));
  if (found.length !== 1) return null;
  const value = found[0]!.slice(name.length + 1);
  return /^[A-Za-z0-9_.-]{1,3500}$/.test(value) ? value : null;
}

export function serializeFlowCookie(
  name: string,
  value: string,
  origin: string,
  maxAge: number,
): string {
  const secure = new URL(origin).protocol === 'https:';
  if (
    !/^(?:__Host-agentgrid_|agentgrid_local_)(?:csrf|oauth|challenge|session)$/.test(name) ||
    secure !== name.startsWith('__Host-') ||
    !/^[A-Za-z0-9_.-]{0,3500}$/.test(value) ||
    !Number.isSafeInteger(maxAge) ||
    maxAge < 0 ||
    maxAge > 2_592_000
  )
    throw new Error('AgentGrid flow cookie is unavailable.');
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}
