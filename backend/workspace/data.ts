import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AuthConfiguration } from '../auth/configuration.ts';
import type { ProviderSession } from '../auth/contracts.ts';
import {
  WorkspaceIdentitySchema,
  WorkspaceListSchema,
  ProfileInputSchema,
  OnboardingInputSchema,
} from '../../src/domain/workspace.ts';
import { HttpFailure } from '../http/guard.ts';
import { SavedListSchema, SaveStateSchema } from '../../src/domain/saves.ts';
import { savedResources } from './saves.ts';
import { databaseFailure } from './failure.ts';
import { draftResources } from './drafts.ts';
import { versionResources } from './versions.ts';
import { reportResources } from './reports.ts';

export interface WorkspaceData {
  identity: () => Promise<z.infer<typeof WorkspaceIdentitySchema>>;
  agents: (offset: number) => Promise<z.infer<typeof WorkspaceListSchema>>;
  onboard: (input: z.infer<typeof OnboardingInputSchema>) => Promise<void>;
  updateProfile: (input: z.infer<typeof ProfileInputSchema>) => Promise<void>;
  visibility: (makePublic: boolean) => Promise<void>;
  favorite: (resourceId: string, saved: boolean) => Promise<boolean>;
  saved: (offset: number) => Promise<z.infer<typeof SavedListSchema>>;
  saveState: (resourceId: string) => Promise<z.infer<typeof SaveStateSchema>>;
  draft: ReturnType<typeof draftResources>['draft'];
  createDraft: ReturnType<typeof draftResources>['createDraft'];
  saveDraft: ReturnType<typeof draftResources>['saveDraft'];
  versions: ReturnType<typeof versionResources>['versions'];
  submitVersion: ReturnType<typeof versionResources>['submitVersion'];
  withdrawVersion: ReturnType<typeof versionResources>['withdrawVersion'];
  versionDocument: ReturnType<typeof versionResources>['versionDocument'];
  reports: ReturnType<typeof reportResources>['reports'];
  createReport: ReturnType<typeof reportResources>['createReport'];
}
export function workspaceData(
  configuration: AuthConfiguration,
  session: ProviderSession,
  transport: typeof fetch = fetch,
): WorkspaceData {
  // Privileged credentials are never used for profile/content authority. The
  // verified user's bearer token reaches PostgreSQL RLS on every operation.
  const client = createClient(configuration.supabaseOrigin, configuration.publishableKey, {
    accessToken: async () => session.accessToken,
    global: {
      fetch: (input, init) =>
        transport(input, { ...init, redirect: 'error', signal: AbortSignal.timeout(10_000) }),
    },
  });
  const identity = async () => {
    const result = await client.rpc('agentgrid_workspace_identity');
    if (result.error) databaseFailure(result.error);
    const parsed = WorkspaceIdentitySchema.safeParse(result.data);
    if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
    return parsed.data;
  };
  const member = async () => {
    const current = await identity();
    if (!current.profile || current.profile.status !== 'active')
      throw new HttpFailure(403, 'request-refused');
    return current.profile;
  };
  const drafts = draftResources(client, member);
  return {
    identity,
    ...savedResources(client, member),
    ...drafts,
    ...versionResources(client, member, drafts),
    ...reportResources(client, member),
    async agents(offset) {
      const profile = await member();
      const result = await client
        .from('agentgrid_agents')
        .select('id,slug,status,created_at')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false })
        .order('id')
        .range(offset, offset + 20);
      if (result.error) databaseFailure(result.error);
      const parsed = WorkspaceListSchema.safeParse({
        agents: result.data.slice(0, 20).map((row) => ({
          id: row.id,
          slug: row.slug,
          status: row.status,
          createdAt: row.created_at,
        })),
        hasMore: result.data.length > 20,
        offset,
      });
      if (!parsed.success) throw new HttpFailure(503, 'service-unavailable');
      return parsed.data;
    },
    async onboard(input) {
      const current = await identity();
      if (
        !current.onboarding.enabled ||
        current.onboarding.termsVersion !== input.termsVersion ||
        current.onboarding.privacyVersion !== input.privacyVersion
      )
        throw new HttpFailure(403, 'terms-required');
      const result = await client.rpc('agentgrid_create_profile', {
        requested_username: input.username,
        requested_display_name: input.displayName,
        accepted_terms_version: input.termsVersion,
        acknowledged_privacy_version: input.privacyVersion,
      });
      if (result.error) databaseFailure(result.error);
      if (!z.uuid().safeParse(result.data).success)
        throw new HttpFailure(503, 'service-unavailable');
    },
    async updateProfile(input) {
      const profile = await member();
      const result = await client.rpc('agentgrid_update_profile', {
        requested_display_name: input.displayName,
        requested_bio: input.bio,
        requested_website: input.website || null,
      });
      if (result.error) databaseFailure(result.error);
      if (result.data !== profile.id) throw new HttpFailure(503, 'service-unavailable');
    },
    async visibility(makePublic) {
      await member();
      const result = await client.rpc('agentgrid_set_profile_visibility', {
        make_public: makePublic,
      });
      if (result.error) databaseFailure(result.error);
    },
    async favorite(resourceId, saved) {
      await member();
      const result = await client.rpc('agentgrid_set_favorite', { resource_id: resourceId, saved });
      if (result.error) databaseFailure(result.error);
      if (result.data !== saved) throw new HttpFailure(503, 'service-unavailable');
      return result.data;
    },
  };
}
