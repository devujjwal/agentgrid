-- Default-off, expiring allowance for the configured first-party administrator.
-- It affects authoring throughput only; no identity, staff, publication or
-- community permissions are granted. Existing counters/windows are retained.
alter table public.agentgrid_configuration
 add column editorial_authoring_until timestamptz;

create function public.agentgrid_enforce_authoring_quota(action_name text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare maximum integer := 10;
begin
 if action_name not in ('create_agent','submit') or action_name is null then
   raise exception 'Unknown authoring action' using errcode='23514';
 end if;
 if public.agentgrid_has_role(array['administrator']) and exists (
   select 1 from public.agentgrid_configuration c
   where c.singleton and c.submission_enabled
     and c.first_party_profile_id=public.agentgrid_profile_id()
     and c.editorial_authoring_until>pg_catalog.clock_timestamp()
 ) then maximum := 40; end if;
 perform public.agentgrid_enforce_quota(action_name,maximum,86400);
end; $agentgrid_function$;
revoke all on function public.agentgrid_enforce_authoring_quota(text)
 from public,anon,authenticated,service_role;

-- Preserve the original entry points and every ownership, fork, licensing,
-- revision, immutable submission and review check; change only the quota call.
create or replace function public.agentgrid_create_agent(requested_slug text, initial_specification jsonb, source_version_id uuid default null, initial_editorial jsonb default '{}')
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource_id uuid; source public.agentgrid_agent_versions%rowtype;
begin
 perform public.agentgrid_enforce_authoring_quota('create_agent');
 perform public.agentgrid_check_resource(initial_specification,requested_slug);
 if source_version_id is not null then
   perform public.agentgrid_enforce_quota('fork',10,86400);
   select * into source from public.agentgrid_agent_versions where id=source_version_id;
   if not found or not public.agentgrid_is_public_agent(source.agent_id)
     or not exists(select 1 from public.agentgrid_submissions where version_id=source.id and state='approved')
     or source.specification#>>'{license,permissions,public_fork}' is distinct from 'true' then
     raise exception 'Source version does not permit public forks' using errcode='42501';
   end if;
   -- Keep the source grant as the initial fork license. Relicensing cannot erase
   -- a source attribution/share condition; custom-license forks need review.
   if initial_specification->'license' is distinct from source.specification->'license' then
     raise exception 'Fork must retain source license' using errcode='23514';
   end if;
 end if;
 insert into public.agentgrid_agents(slug,owner_id,forked_from_version_id)
 values(requested_slug,public.agentgrid_profile_id(),source_version_id) returning id into resource_id;
 insert into public.agentgrid_drafts(agent_id,specification,editorial) values(resource_id,initial_specification,initial_editorial);
 return resource_id;
end; $agentgrid_function$;

create or replace function public.agentgrid_submit_version(resource_id uuid, expected_revision integer)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource public.agentgrid_agents%rowtype; draft public.agentgrid_drafts%rowtype; version_id uuid;
begin
 perform public.agentgrid_enforce_authoring_quota('submit');
 if not exists(select 1 from public.agentgrid_configuration where singleton and submission_enabled) then
   raise exception 'Submissions unavailable' using errcode='42501';
 end if;
 select * into resource from public.agentgrid_agents where id=resource_id for update;
 if not found or resource.owner_id<>public.agentgrid_profile_id() or resource.status<>'active' then
   raise exception 'Resource unavailable' using errcode='42501';
 end if;
 select * into draft from public.agentgrid_drafts where agent_id=resource_id;
 if draft.revision is distinct from expected_revision then
   raise exception 'Draft changed; reload before submitting' using errcode='40001';
 end if;
 perform public.agentgrid_check_resource(draft.specification,resource.slug);
 if draft.specification#>>'{license,identifier}'='unselected'
   or draft.specification#>>'{license,permissions,use}'<>'true' then
   raise exception 'An explicit use license is required' using errcode='23514';
 end if;
 if exists(select 1 from public.agentgrid_submissions s join public.agentgrid_agent_versions v on v.id=s.version_id
   where v.agent_id=resource_id and s.state='pending') then
   raise exception 'A version is already awaiting review' using errcode='23505';
 end if;
 if exists(select 1 from public.agentgrid_agent_versions where agent_id=resource_id and version=draft.specification->>'version') then
   raise exception 'Submitted versions cannot be reused' using errcode='23505'; end if;
 if exists(select 1 from public.agentgrid_agent_versions where agent_id=resource_id
   and pg_catalog.string_to_array(version,'.')::numeric[] >= pg_catalog.string_to_array(draft.specification->>'version','.')::numeric[]) then
   raise exception 'A new submission must advance the package version' using errcode='23514'; end if;
 insert into public.agentgrid_agent_versions(agent_id,version,specification,editorial,category_slug,submitted_by)
 values(resource_id,draft.specification->>'version',draft.specification,draft.editorial,draft.specification->>'category',resource.owner_id)
 returning id into version_id;
 insert into public.agentgrid_version_platforms(version_id,platform_slug)
 select version_id,item->>'slug' from pg_catalog.jsonb_array_elements(draft.specification->'platforms') item;
 insert into public.agentgrid_submissions(version_id) values(version_id);
 return version_id;
end; $agentgrid_function$;
