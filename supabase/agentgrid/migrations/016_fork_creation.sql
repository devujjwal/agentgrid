-- Fork construction is atomic and copies only the reusable portable definition.
-- Editorial review/evidence and publication authority never transfer to a fork.
create function public.agentgrid_bound_fork_lineage()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$
declare depth integer;
begin
 if new.forked_from_version_id is null then return new; end if;
 with recursive ancestors as (
  select 1 as depth,a.forked_from_version_id from public.agentgrid_agent_versions v
  join public.agentgrid_agents a on a.id=v.agent_id where v.id=new.forked_from_version_id
  union all
  select p.depth+1,a.forked_from_version_id from ancestors p
  join public.agentgrid_agent_versions v on v.id=p.forked_from_version_id
  join public.agentgrid_agents a on a.id=v.agent_id where p.depth<33
 ) select max(a.depth) into depth from ancestors a;
 if depth>32 then raise exception 'Fork lineage limit reached' using errcode='23514'; end if;
 return new;
end; $agentgrid_function$;
create trigger agentgrid_agents_lineage_bound before insert on public.agentgrid_agents
for each row execute function public.agentgrid_bound_fork_lineage();

create function public.agentgrid_fork_source(source_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('sourceVersionId',v.id,'resourceId',a.id,
  'slug',a.slug,'name',v.specification#>>'{identity,name}','version',v.version,
  'license',v.specification->'license',
  'creatorName',case when p.status='deactivated' then 'Deleted creator'
    when p.id=c.first_party_profile_id then 'AgentGrid Editorial'
    when p.visibility='public' then p.display_name else 'Community creator' end)
 into result from public.agentgrid_agent_versions v
 join public.agentgrid_agents a on a.id=v.agent_id
 join public.agentgrid_profiles p on p.id=a.owner_id
 join public.agentgrid_submissions s on s.version_id=v.id
 cross join public.agentgrid_configuration c
 where v.id=source_version_id and c.singleton and s.state='approved'
 and public.agentgrid_is_public_agent(a.id)
 and v.specification#>>'{license,permissions,public_fork}'='true';
 return result;
end; $agentgrid_function$;

create function public.agentgrid_fork_agent(source_version_id uuid,requested_slug text,requested_name text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id(); source public.agentgrid_agent_versions%rowtype;
 existing public.agentgrid_agents%rowtype; definition jsonb; created_id uuid;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 -- Same lock order as creation/quotas. Serializes retries by this member.
 perform 1 from public.agentgrid_profiles where id=actor for update;
 if requested_name is null or char_length(btrim(requested_name)) not between 4 and 100
  or requested_slug is null or char_length(requested_slug) not between 3 and 80
  or requested_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  or requested_slug in ('categories','new','search','submit') or source_version_id is null then
  raise exception 'Valid fork identity required' using errcode='23514'; end if;
 select * into existing from public.agentgrid_agents where slug=requested_slug;
 if found then
  if existing.owner_id=actor and existing.forked_from_version_id=source_version_id then
   return pg_catalog.jsonb_build_object('resourceId',existing.id,'slug',existing.slug,
    'sourceVersionId',existing.forked_from_version_id,'created',false);
  end if;
  raise exception 'Resource path unavailable' using errcode='23505';
 end if;
 select * into source from public.agentgrid_agent_versions where id=source_version_id;
 if not found then raise exception 'Fork source unavailable' using errcode='42501'; end if;
 perform 1 from public.agentgrid_agents where id=source.agent_id and status='active' for share;
 if not found or public.agentgrid_fork_source(source_version_id) is null then
  raise exception 'Fork source unavailable' using errcode='42501'; end if;
 definition:=pg_catalog.jsonb_set(source.specification,'{identity,slug}',pg_catalog.to_jsonb(requested_slug));
 definition:=pg_catalog.jsonb_set(definition,'{identity,name}',pg_catalog.to_jsonb(btrim(requested_name)));
 definition:=pg_catalog.jsonb_set(definition,'{version}','"0.1.0"'::jsonb);
 created_id:=public.agentgrid_create_agent(requested_slug,definition,source_version_id,'{}'::jsonb);
 return pg_catalog.jsonb_build_object('resourceId',created_id,'slug',requested_slug,
  'sourceVersionId',source_version_id,'created',true);
end; $agentgrid_function$;
revoke all on function public.agentgrid_bound_fork_lineage(),public.agentgrid_fork_source(uuid),
 public.agentgrid_fork_agent(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_fork_source(uuid),public.agentgrid_fork_agent(uuid,text,text) to authenticated;
