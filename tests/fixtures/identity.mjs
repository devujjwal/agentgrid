// Synthetic HTTP acceptance only. No real provider calls or published identities.
import { identityRuntime } from '../../backend/auth/runtime.ts';
import { identityHandler } from '../../backend/http/identity.ts';
import { HttpFailure } from '../../backend/http/guard.ts';
export const identityOrigin = 'https://agentgrid.me';
export const syntheticSubject = 'b87eb15c-36eb-426f-97fe-c00000000001';
export function syntheticConfiguration() {
  return {
    stage: 'production',
    origin: identityOrigin,
    supabaseOrigin: 'https://synthetic.supabase.co',
    publishableKey: 'sb_publishable_' + 'p'.repeat(24),
    secretKey: 'sb_secret_' + 's'.repeat(24),
    resendKey: 're_' + 'r'.repeat(24),
    fromEmail: 'signin@mail.agentgrid.me',
    pilotEmails: [],
    rateKey: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
    envelopeKeys: [
      {
        id: 'current',
        material: Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'),
      },
    ],
  };
}
export async function identityFixture() {
  let clock = Math.floor(Date.now() / 1000);
  const flows = new Map(),
    sessions = new Map(),
    calls = [],
    sent = [],
    jar = new Map();
  const session = () => ({
    subject: syntheticSubject,
    accessToken: 'synthetic-access-' + clock,
    refreshToken: 'synthetic-refresh-token-only',
    expiresAt: clock + 3600,
  });
  const faults = {
    rate: false,
    identity: false,
    refresh: false,
    provider: false,
    wrongEmail: false,
  };
  const managed = {
    async emailChallenge() {
      calls.push('generate');
      return { code: '12345678', tokenHash: 'a'.repeat(64) };
    },
    async verifyEmail() {
      calls.push('verify');
      return session();
    },
    async startGoogle() {
      calls.push('google');
      return {
        destination: 'https://synthetic.supabase.co/auth/v1/authorize?synthetic=1',
        verifier: 'synthetic-pkce-verifier-only',
      };
    },
    async finishGoogle(code, verifier) {
      calls.push(['exchange', code, verifier]);
      return session();
    },
    async refresh() {
      calls.push('refresh');
      if (faults.refresh) throw new HttpFailure(401, 'not-signed-in');
      return session();
    },
    async verify() {
      calls.push('getUser');
      if (faults.identity) throw new HttpFailure(401, 'not-signed-in');
      if (faults.provider) throw new Error('Synthetic PRIVATE provider message');
      return {
        id: syntheticSubject,
        email: faults.wrongEmail ? 'different@example.test' : 'owner@example.test',
      };
    },
    async signOut() {
      calls.push('local-signout');
    },
  };
  const store = {
    async allow(action, ip, address) {
      calls.push(['budget', action, ip, address]);
      return !faults.rate;
    },
    async createFlow(id, purpose, binding, code, encryptedState) {
      flows.set(id, {
        purpose,
        binding,
        code,
        encryptedState,
        attempts: 0,
        used: false,
        expires: clock + (purpose === 'email' ? 300 : 600),
      });
    },
    async consumeFlow(id, purpose, binding, code) {
      const flow = flows.get(id);
      if (
        !flow ||
        flow.used ||
        flow.purpose !== purpose ||
        flow.binding !== binding ||
        flow.expires <= clock ||
        flow.attempts >= 5
      )
        return null;
      flow.attempts++;
      if (flow.code !== code) return null;
      flow.used = true;
      return flow.encryptedState;
    },
    async createSession(id, subject, encryptedState) {
      sessions.set(id, { subject, encryptedState, revision: 1, expiresAt: clock + 2592000 });
      return true;
    },
    async loadSession(id) {
      const row = sessions.get(id);
      return row && row.expiresAt > clock ? { ...row } : null;
    },
    async replaceSession(id, revision, encryptedState) {
      const row = sessions.get(id);
      if (!row || row.revision !== revision) return false;
      row.encryptedState = encryptedState;
      row.revision++;
      return true;
    },
    async revokeSession(id) {
      sessions.delete(id);
    },
  };
  const configuration = syntheticConfiguration();
  const runtime = await identityRuntime(configuration, store, managed, () => clock);
  const handle = identityHandler(runtime, async (email) => {
    sent.push(email);
  });
  let csrf;
  async function request(path, body, options = {}) {
    const method = body === undefined ? 'GET' : 'POST';
    const headers = {
      cookie: [...jar].map(([key, value]) => key + '=' + value).join('; '),
      ...(method === 'POST'
        ? {
            origin: identityOrigin,
            'content-type': 'application/json',
            'x-agentgrid-csrf': csrf ?? '',
          }
        : {}),
      ...options.headers,
    };
    const response = await handle(
      new Request((options.origin ?? identityOrigin) + path, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        headers,
      }),
      options.ip ?? '192.0.2.9',
    );
    if (options.capture !== false)
      for (const cookie of response.headers.getSetCookie()) {
        const first = cookie.split(';')[0],
          equal = first.indexOf('=');
        const key = first.slice(0, equal),
          value = first.slice(equal + 1);
        if (value) jar.set(key, value);
        else jar.delete(key);
      }
    const data = await response.json();
    if (data?.csrf) csrf = data.csrf;
    return { response, data };
  }
  return {
    request,
    runtime,
    store,
    managed,
    flows,
    sessions,
    calls,
    sent,
    jar,
    faults,
    advance(seconds) {
      clock += seconds;
    },
    session,
    now: () => clock,
  };
}
