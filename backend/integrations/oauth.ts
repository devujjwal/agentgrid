import { z } from 'zod';
import { sealSocialTokens } from '../execution/social-secrets.ts';
import { providerJson, requireEnabled, sha256 } from './http.ts';
export type SocialPlatform = 'instagram' | 'facebook' | 'linkedin';
export interface OAuthState {
  digest: string;
  ownerId: string;
  sessionDigest: string;
  platform: SocialPlatform;
  redirectUri: string;
  expiresAt: string;
}
export interface OAuthStore {
  create(state: OAuthState): Promise<void>;
  /** Atomic consume with exact owner/session/platform binding and expiry check. */
  consume(
    digest: string,
    ownerId: string,
    sessionDigest: string,
    platform: SocialPlatform,
  ): Promise<OAuthState | null>;
  connect(value: {
    id: string;
    ownerId: string;
    platform: SocialPlatform;
    accountId: string;
    expiresAt: string;
    sealedTokens: string;
    scopes: string[];
  }): Promise<void>;
}
const platformSchema = z.enum(['instagram', 'facebook', 'linkedin']);
const metaScopes = {
  instagram: [
    'pages_show_list',
    'pages_read_engagement',
    'instagram_basic',
    'instagram_content_publish',
  ],
  facebook: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts'],
};
const linkedinScopes = ['openid', 'profile', 'w_member_social', 'r_member_social'];
export function socialOAuth(options: {
  enabled: () => boolean;
  transport: typeof fetch;
  now: () => Date;
  store: OAuthStore;
  origin: string;
  metaVersion: string;
  key: Uint8Array;
  credentials: (platform: SocialPlatform) => Promise<{ clientId: string; clientSecret: string }>;
}) {
  const origin = new URL(options.origin);
  if (
    origin.origin !== options.origin ||
    origin.protocol !== 'https:' ||
    !['agentgrid.me', 'agentgrid-staging.pages.dev'].includes(origin.hostname)
  )
    throw new Error('OAuth origin refused.');
  if (!/^v[0-9]{1,2}\.0$/.test(options.metaVersion))
    throw new Error('Reviewed Meta API version required.');
  const scopes = (platform: SocialPlatform) =>
    platform === 'linkedin' ? linkedinScopes : metaScopes[platform];
  const callback = (platform: SocialPlatform) =>
    `${origin.origin}/api/social/${platform}/callback/`;
  async function credentials(platform: SocialPlatform) {
    requireEnabled(options.enabled);
    return z
      .strictObject({
        clientId: z.string().min(1).max(300),
        clientSecret: z.string().min(1).max(8000),
      })
      .parse(await options.credentials(platform));
  }
  return {
    async start(ownerId: string, sessionDigest: string, platform: SocialPlatform) {
      requireEnabled(options.enabled);
      z.uuid().parse(ownerId);
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(sessionDigest);
      platformSchema.parse(platform);
      const credential = await credentials(platform);
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const state = Array.from(bytes, (n) => n.toString(16).padStart(2, '0')).join('');
      const digest = await sha256(new TextEncoder().encode(state));
      await options.store.create({
        digest,
        ownerId,
        sessionDigest,
        platform,
        redirectUri: callback(platform),
        expiresAt: new Date(options.now().getTime() + 600_000).toISOString(),
      });
      const url = new URL(
        platform === 'linkedin'
          ? 'https://www.linkedin.com/oauth/v2/authorization'
          : `https://www.facebook.com/${options.metaVersion}/dialog/oauth`,
      );
      url.search = new URLSearchParams({
        client_id: credential.clientId,
        redirect_uri: callback(platform),
        response_type: 'code',
        state,
        scope: scopes(platform).join(platform === 'linkedin' ? ' ' : ','),
      }).toString();
      return { authorizationUrl: url.href };
    },
    /** Caller must authenticate the current member; never accepts a provider account ID from HTTP. */
    async complete(input: {
      ownerId: string;
      sessionDigest: string;
      platform: SocialPlatform;
      state: string;
      code?: string;
      denied?: boolean;
      signal: AbortSignal;
    }) {
      requireEnabled(options.enabled);
      z.uuid().parse(input.ownerId);
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(input.sessionDigest);
      platformSchema.parse(input.platform);
      z.string()
        .regex(/^[a-f0-9]{64}$/)
        .parse(input.state);
      const state = await options.store.consume(
        await sha256(new TextEncoder().encode(input.state)),
        input.ownerId,
        input.sessionDigest,
        input.platform,
      );
      if (
        !state ||
        state.ownerId !== input.ownerId ||
        state.sessionDigest !== input.sessionDigest ||
        state.platform !== input.platform ||
        state.redirectUri !== callback(input.platform) ||
        Date.parse(state.expiresAt) <= options.now().getTime()
      )
        throw new Error('OAuth state unavailable.');
      if (input.denied) return { connections: [] };
      const code = z.string().min(1).max(4000).parse(input.code);
      const credential = await credentials(input.platform);
      const linkedin = input.platform === 'linkedin';
      const tokenUrl = linkedin
        ? 'https://www.linkedin.com/oauth/v2/accessToken'
        : `https://graph.facebook.com/${options.metaVersion}/oauth/access_token`;
      const token = z
        .object({
          access_token: z.string().min(1).max(8000),
          expires_in: z
            .number()
            .int()
            .positive()
            .max(366 * 86400),
          refresh_token: z.string().max(8000).optional(),
          scope: z.string().optional(),
        })
        .parse(
          (
            await providerJson(options.transport, tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: state.redirectUri,
                client_id: credential.clientId,
                client_secret: credential.clientSecret,
              }).toString(),
              signal: input.signal,
            })
          ).body,
        );
      const expiresAt = new Date(options.now().getTime() + token.expires_in * 1000).toISOString();
      const auth = {
        headers: { Authorization: `Bearer ${token.access_token}` },
        signal: input.signal,
      };
      let granted: string[];
      const accounts: { accountId: string; token: string }[] = [];
      if (linkedin) {
        granted = token.scope?.split(/[ ,]+/).filter(Boolean) ?? [];
        if (!linkedinScopes.every((s) => granted.includes(s)))
          throw new Error('LinkedIn permissions incomplete.');
        const identity = z
          .object({ sub: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/) })
          .parse(
            (await providerJson(options.transport, 'https://api.linkedin.com/v2/userinfo', auth))
              .body,
          );
        accounts.push({ accountId: `urn:li:person:${identity.sub}`, token: token.access_token });
      } else {
        const base = `https://graph.facebook.com/${options.metaVersion}/`;
        const permissions = z
          .object({
            data: z.array(z.object({ permission: z.string(), status: z.string() })).max(100),
          })
          .parse((await providerJson(options.transport, base + 'me/permissions', auth)).body);
        granted = permissions.data.filter((p) => p.status === 'granted').map((p) => p.permission);
        if (!scopes(input.platform).every((s) => granted.includes(s)))
          throw new Error('Meta permissions incomplete.');
        const pages = z
          .object({
            data: z
              .array(
                z.object({
                  id: z.string().regex(/^[0-9]{1,80}$/),
                  access_token: z.string().min(1).max(8000),
                  tasks: z.array(z.string()),
                  instagram_business_account: z
                    .object({ id: z.string().regex(/^[0-9]{1,80}$/) })
                    .optional(),
                }),
              )
              .max(100),
          })
          .parse(
            (
              await providerJson(
                options.transport,
                base +
                  'me/accounts?fields=id,access_token,tasks,instagram_business_account&limit=100',
                auth,
              )
            ).body,
          );
        for (const page of pages.data) {
          if (!page.tasks.includes('CREATE_CONTENT') && !page.tasks.includes('MANAGE')) continue;
          const accountId =
            input.platform === 'facebook' ? page.id : page.instagram_business_account?.id;
          if (accountId) accounts.push({ accountId, token: page.access_token });
        }
      }
      // All discovered connections remain disabled; later explicit selection/approval is required.
      const connections: { id: string; platform: SocialPlatform }[] = [];
      for (const account of accounts) {
        requireEnabled(options.enabled);
        const id = crypto.randomUUID();
        const sealedTokens = await sealSocialTokens(
          options.key,
          { ownerId: input.ownerId, connectionId: id, platform: input.platform },
          {
            accessToken: account.token,
            refreshToken: linkedin ? (token.refresh_token ?? null) : null,
            expiresAt,
          },
        );
        await options.store.connect({
          id,
          ownerId: input.ownerId,
          platform: input.platform,
          accountId: account.accountId,
          expiresAt,
          sealedTokens,
          scopes: granted,
        });
        connections.push({ id, platform: input.platform });
      }
      return { connections };
    },
  };
}
