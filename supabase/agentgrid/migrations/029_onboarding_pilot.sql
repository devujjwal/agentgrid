-- A short-lived database-level admission pilot, independent of the HTTP pilot.
-- No identity is enrolled and global registration remains unchanged by this migration.
create table public.agentgrid_onboarding_pilots (
  user_id uuid primary key references auth.users(id) on delete cascade deferrable initially immediate,
  created_at timestamptz not null default pg_catalog.now(),
  expires_at timestamptz not null,
  constraint agentgrid_onboarding_pilots_duration check (
    expires_at > created_at and expires_at <= created_at + interval '14 days'
  )
);
alter table public.agentgrid_onboarding_pilots enable row level security;
revoke all on table public.agentgrid_onboarding_pilots from public,anon,authenticated,service_role;

-- Not callable by clients: the two existing member RPCs expose only the caller's
-- eligibility. No email, invitation list, metadata role or privileged credential.
create function public.agentgrid_can_create_profile()
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select coalesce((select auth.uid() is not null
   and c.community_terms_version is not null and c.privacy_notice_version is not null
   and (c.profile_creation_enabled or exists (
     select 1 from public.agentgrid_onboarding_pilots p
     where p.user_id=auth.uid() and p.expires_at > pg_catalog.now()
   )) from public.agentgrid_configuration c where c.singleton),false);
$agentgrid_function$;
revoke all on function public.agentgrid_can_create_profile() from public,anon,authenticated,service_role;

create or replace function public.agentgrid_create_profile(
  requested_username text, requested_display_name text,
  accepted_terms_version text, acknowledged_privacy_version text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $agentgrid_function$
declare
  actor uuid := auth.uid();
  profile uuid;
  configuration public.agentgrid_configuration%rowtype;
begin
  if actor is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if requested_username ~ '^u_' then
    raise exception 'Username prefix is reserved' using errcode = '23514';
  end if;
  select * into configuration from public.agentgrid_configuration where singleton;
  if not public.agentgrid_can_create_profile()
    or accepted_terms_version is distinct from configuration.community_terms_version
    or acknowledged_privacy_version is distinct from configuration.privacy_notice_version then
    raise exception 'Current AgentGrid terms are required' using errcode = '42501';
  end if;
  if exists (select 1 from public.agentgrid_identities where user_id = actor) then
    raise exception 'AgentGrid profile already exists' using errcode = '23505';
  end if;
  insert into public.agentgrid_profiles (username, display_name, terms_version, privacy_version)
  values (requested_username, requested_display_name, accepted_terms_version, acknowledged_privacy_version)
  returning id into profile;
  insert into public.agentgrid_identities (user_id, profile_id) values (actor, profile);
  return profile;
end
$agentgrid_function$;


-- Live self-only profile and current consent configuration. This is not a public
-- creator projection and conveys no role from managed Auth/user metadata.
create or replace function public.agentgrid_workspace_identity()
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id(); result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object(
  'profile',(select pg_catalog.jsonb_build_object('id',p.id,'username',p.username,
    'displayName',p.display_name,'bio',p.bio,'website',p.website_url,
    'visibility',p.visibility,'status',p.status) from public.agentgrid_profiles p where p.id=actor),
  'roles',coalesce((select pg_catalog.jsonb_agg(r.role order by r.role)
    from public.agentgrid_user_roles r where r.user_id=actor and public.agentgrid_is_member()),'[]'::jsonb),
  'onboarding',pg_catalog.jsonb_build_object('enabled',public.agentgrid_can_create_profile(),
    'termsVersion',c.community_terms_version,'privacyVersion',c.privacy_notice_version))
 into result from public.agentgrid_configuration c where c.singleton;
 return result;
end
$agentgrid_function$;
revoke all on function public.agentgrid_workspace_identity() from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_workspace_identity() to authenticated;

