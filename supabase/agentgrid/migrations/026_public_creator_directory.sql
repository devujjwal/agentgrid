-- Live, anonymous, bounded projection. No Auth data or private drafts.
create function public.agentgrid_public_creator_page(handle text, requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare creator public.agentgrid_profiles%rowtype; items jsonb; first_party boolean;
begin
 if handle is null or handle !~ '^[a-z][a-z0-9_]{2,29}$' or requested_offset is null
  or requested_offset<0 or requested_offset>9980 or requested_offset%20<>0 then
  raise exception 'Invalid creator request' using errcode='23514'; end if;
 select * into creator from public.agentgrid_profiles p
 where p.username=handle and public.agentgrid_is_public_profile(p.id);
 if not found then return null; end if;
 select c.first_party_profile_id=creator.id into first_party from public.agentgrid_configuration c where singleton;
 select coalesce(jsonb_agg(to_jsonb(entry) order by entry."releasedAt" desc,entry.id),'[]'::jsonb) into items from (
  select a.id,a.slug,v.specification#>>'{identity,name}' as name,
   v.specification#>>'{identity,summary}' as summary,v.category_slug as category,
   v.version,r.released_at as "releasedAt"
  from public.agentgrid_agents a join public.agentgrid_releases r on r.agent_id=a.id
  join public.agentgrid_agent_versions v on v.id=r.version_id
  where a.owner_id=creator.id and public.agentgrid_is_public_agent(a.id)
  order by r.released_at desc,a.id limit 21 offset requested_offset
 ) entry;
 return jsonb_build_object('id',creator.id,'username',creator.username,
  'displayName',case when coalesce(first_party,false) then 'AgentGrid Editorial' else creator.display_name end,
  'bio',creator.bio,'website',creator.website_url,
  'kind',case when coalesce(first_party,false) then 'first-party' else 'community' end,
  'agents',items);
end; $agentgrid_function$;
revoke all on function public.agentgrid_public_creator_page(text,integer) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_public_creator_page(text,integer) to anon,authenticated;
