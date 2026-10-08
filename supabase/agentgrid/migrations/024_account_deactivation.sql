-- Bind irreversible AgentGrid-only removal to the exact business profile shown
-- to its owner. A stale request must never remove a later re-created profile.
create function public.agentgrid_deactivate_profile(expected_profile_id uuid,confirmed_username text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_is_member() then raise exception 'Active member required' using errcode='42501'; end if;
 if expected_profile_id is null or public.agentgrid_profile_id() is distinct from expected_profile_id then
  raise exception 'Profile changed; reload before account removal' using errcode='40001'; end if;
 perform public.agentgrid_deactivate_account(confirmed_username);
 return pg_catalog.jsonb_build_object('profileId',expected_profile_id,'deactivated',true);
end; $agentgrid_function$;
revoke all on function public.agentgrid_deactivate_account(text) from public,anon,authenticated,service_role;
revoke all on function public.agentgrid_deactivate_profile(uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_deactivate_profile(uuid,text) to authenticated;
