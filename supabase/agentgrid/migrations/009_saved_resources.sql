-- Live, self-only saves. Withdrawn resources remain removable tombstones.
create function public.agentgrid_saved_agents(requested_offset integer default 0)
returns table(agent_id uuid,saved_at timestamptz,available boolean,slug text,title text,summary text,category_slug text)
language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id();
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if requested_offset is null or requested_offset not between 0 and 9999 then
  raise exception 'Invalid offset' using errcode='23514'; end if;
 return query
 select f.agent_id,f.created_at,visible.allowed,
  case when visible.allowed then a.slug else null end,
  case when visible.allowed then v.specification#>>'{identity,name}' else null end,
  case when visible.allowed then v.specification#>>'{identity,summary}' else null end,
  case when visible.allowed then v.category_slug else null end
 from public.agentgrid_favorites f join public.agentgrid_agents a on a.id=f.agent_id
 left join public.agentgrid_releases r on r.agent_id=a.id
 left join public.agentgrid_agent_versions v on v.id=r.version_id
 cross join lateral (select public.agentgrid_is_public_agent(f.agent_id) as allowed) visible
 where f.profile_id=own_profile order by f.created_at desc,f.agent_id
 limit 21 offset requested_offset;
end; $agentgrid_function$;

create function public.agentgrid_resource_save_state(resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id();
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if resource_id is null then raise exception 'Resource required' using errcode='23514'; end if;
 return pg_catalog.jsonb_build_object('saved',exists(select 1 from public.agentgrid_favorites f
   where f.profile_id=own_profile and f.agent_id=resource_id),
  'available',public.agentgrid_is_public_agent(resource_id));
end; $agentgrid_function$;

revoke all on function public.agentgrid_saved_agents(integer),public.agentgrid_resource_save_state(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_saved_agents(integer),public.agentgrid_resource_save_state(uuid) to authenticated;
