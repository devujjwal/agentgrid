import { z } from 'zod';

export const OpaqueSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const IdentitySchema = z.strictObject({
  id: z.uuid(),
  email: z.email().max(254),
});
export const ProviderSessionSchema = z.strictObject({
  subject: z.uuid(),
  accessToken: z.string().min(20).max(12_000),
  // Managed refresh tokens are opaque; the real provider currently issues
  // 12-character values. Their length is not local proof of identity.
  refreshToken: z.string().min(1).max(2048),
  expiresAt: z.int().positive(),
});
export type VerifiedIdentity = z.infer<typeof IdentitySchema>;
export type ProviderSession = z.infer<typeof ProviderSessionSchema>;

export interface ManagedIdentity {
  emailChallenge(email: string): Promise<{ code: string; tokenHash: string }>;
  verifyEmail(tokenHash: string): Promise<ProviderSession>;
  startGoogle(): Promise<{ destination: string; verifier: string }>;
  finishGoogle(code: string, verifier: string): Promise<ProviderSession>;
  refresh(refreshToken: string): Promise<ProviderSession>;
  verify(session: ProviderSession): Promise<VerifiedIdentity>;
  signOut(session: ProviderSession): Promise<void>;
}

export interface SessionRecord {
  encryptedState: string;
  revision: number;
  expiresAt: number;
}
export interface IdentityStore {
  allow(action: 'email' | 'google' | 'verify', ip: string, address?: string): Promise<boolean>;
  createFlow(
    id: string,
    purpose: 'email' | 'google',
    binding: string,
    code: string | null,
    encryptedState: string,
  ): Promise<void>;
  consumeFlow(
    id: string,
    purpose: 'email' | 'google',
    binding: string,
    code: string | null,
  ): Promise<string | null>;
  createSession(id: string, subject: string, encryptedState: string): Promise<boolean>;
  loadSession(id: string): Promise<SessionRecord | null>;
  replaceSession(id: string, revision: number, encryptedState: string): Promise<boolean>;
  revokeSession(id: string): Promise<void>;
}

/** Cryptographic randomness, never an application/managed user identifier. */
export function opaqueToken(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}
