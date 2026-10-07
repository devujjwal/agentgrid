-- Live self-only profile and current consent configuration. This is not a public
-- creator projection and conveys no role from managed Auth/user metadata.
create function public.agentgrid_workspace_identity()
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
  'onboarding',pg_catalog.jsonb_build_object('enabled',c.profile_creation_enabled,
    'termsVersion',c.community_terms_version,'privacyVersion',c.privacy_notice_version))
 into result from public.agentgrid_configuration c where c.singleton;
 return result;
end
$agentgrid_function$;
revoke all on function public.agentgrid_workspace_identity() from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_workspace_identity() to authenticated;

-- Bound owned profile writes even when callers bypass the application UI.
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile'));
revoke update(display_name,bio,website_url) on public.agentgrid_profiles from authenticated;
create function public.agentgrid_update_profile(requested_display_name text,requested_bio text,requested_website text)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id();
begin
 perform public.agentgrid_enforce_quota('profile',60,3600);
 update public.agentgrid_profiles set display_name=requested_display_name,bio=requested_bio,website_url=requested_website
 where id=actor and status='active';
 if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
 return actor;
end
$agentgrid_function$;
create or replace function public.agentgrid_set_profile_visibility(make_public boolean)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
begin
 perform public.agentgrid_enforce_quota('profile',60,3600);
 if make_public is null then raise exception 'Visibility required' using errcode='23514'; end if;
 update public.agentgrid_profiles set visibility=case when make_public then 'public' else 'private' end
 where id=public.agentgrid_profile_id();
end
$agentgrid_function$;
revoke all on function public.agentgrid_update_profile(text,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_update_profile(text,text,text) to authenticated;
