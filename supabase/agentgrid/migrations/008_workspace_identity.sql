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
