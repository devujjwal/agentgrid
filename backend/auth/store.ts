import { providerFetch } from '../http/provider-fetch.ts';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthConfiguration } from './configuration.ts';
import type { IdentityStore } from './contracts.ts';
import { HttpFailure } from '../http/guard.ts';

/** Only enumerated AgentGrid RPCs. No caller-selected table/function, shared
 * application data, managed Auth DDL or direct service-role table access.
 */
export function identityStore(
  configuration: AuthConfiguration,
  transport: typeof fetch = fetch,
  reportFailure: (event: { operation: string; status: number }) => void = () => {},
): IdentityStore {
  const client = createClient(configuration.supabaseOrigin, configuration.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) =>
        providerFetch(transport, input, {
          ...init,
          signal: AbortSignal.timeout(10_000),
        }),
    },
  });
  const call = async (name: string, parameters: Record<string, unknown>): Promise<unknown> => {
    const result = await client.rpc(name, parameters);
    if (result.error) {
      // Fixed operation names and numeric HTTP status only. Never provider
      // messages, bodies, headers, parameters, credentials or user identifiers.
      reportFailure({
        operation: name,
        status: Number.isInteger(result.status) ? result.status : 0,
      });
      throw new HttpFailure(503, 'service-unavailable');
    }
    return result.data;
  };
  const boolean = async (name: string, parameters: Record<string, unknown>) => {
    const result = await call(name, parameters);
    if (typeof result !== 'boolean') throw new HttpFailure(503, 'service-unavailable');
    return result;
  };
  return {
    allow: (action, ip, address) =>
      boolean('agentgrid_auth_allow', {
        action_name: action,
        ip_digest: ip,
        address_digest: address ?? null,
      }),
    async createFlow(id, purpose, binding, code, encryptedState) {
      await call('agentgrid_auth_flow_create', {
        flow_digest: id,
        flow_purpose: purpose,
        browser_binding: binding,
        verification_digest: code,
        encrypted_state: encryptedState,
      });
    },
    async consumeFlow(id, purpose, binding, code) {
      const result = await call('agentgrid_auth_flow_consume', {
        flow_digest: id,
        flow_purpose: purpose,
        browser_binding: binding,
        verification_digest: code,
      });
      if (result !== null && typeof result !== 'string')
        throw new HttpFailure(503, 'service-unavailable');
      return result;
    },
    createSession: (id, subject, encryptedState) =>
      boolean('agentgrid_auth_session_create', {
        session_digest: id,
        verified_subject_digest: subject,
        encrypted_state: encryptedState,
      }),
    async loadSession(id) {
      const result = await call('agentgrid_auth_session_load', { session_digest: id });
      const parsed = z
        .array(
          z.strictObject({
            encrypted_state: z.string().min(1).max(40_000),
            revision: z.int().positive(),
            expires_at: z.iso.datetime({ offset: true }),
          }),
        )
        .max(1)
        .safeParse(result);
      if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
      const row = parsed.data[0];
      return row
        ? {
            encryptedState: row.encrypted_state,
            revision: row.revision,
            expiresAt: Math.floor(Date.parse(row.expires_at) / 1000),
          }
        : null;
    },
    replaceSession: (id, revision, encryptedState) =>
      boolean('agentgrid_auth_session_replace', {
        session_digest: id,
        expected_revision: revision,
        encrypted_state: encryptedState,
      }),
    async revokeSession(id) {
      await call('agentgrid_auth_session_revoke', { session_digest: id });
    },
  };
}
