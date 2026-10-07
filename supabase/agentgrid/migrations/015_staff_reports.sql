-- A private, immutable record of the public content observed at report creation.
-- Existing reports remain explicitly without a captured snapshot; do not invent
-- historical context from their targets' current content.
create table public.agentgrid_report_contexts (
 report_id uuid primary key references public.agentgrid_reports(id) on delete restrict deferrable initially immediate,
 captured_at timestamptz not null default pg_catalog.now(),
 snapshot jsonb not null check(pg_catalog.jsonb_typeof(snapshot)='object' and pg_catalog.octet_length(snapshot::text)<=150000)
);
alter table public.agentgrid_report_contexts enable row level security;
revoke all on public.agentgrid_report_contexts from public,anon,authenticated,service_role;
grant select on public.agentgrid_report_contexts to authenticated;
create policy agentgrid_report_contexts_staff on public.agentgrid_report_contexts for select to authenticated
 using(public.agentgrid_has_role(array['moderator','administrator']));
create trigger agentgrid_report_contexts_immutable before update or delete on public.agentgrid_report_contexts
 for each row execute function public.agentgrid_deny_immutable_mutation();

alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review','moderate-report'));
create index agentgrid_reports_state_queue on public.agentgrid_reports(state,created_at,id);

create or replace function public.agentgrid_create_report(target_kind text,target_id uuid,report_category text,details text)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare result uuid; context jsonb;
begin
 perform public.agentgrid_enforce_quota('report',10,86400);
 -- Availability and snapshot are read together. These projections contain only
 -- formerly public content, never draft/editorial evidence or auth identities.
 if target_kind='agent' then
  select pg_catalog.jsonb_build_object('kind','agent','slug',a.slug,'versionId',v.id,'version',v.version,'specification',v.specification)
   into context from public.agentgrid_agents a join public.agentgrid_releases rel on rel.agent_id=a.id
   join public.agentgrid_agent_versions v on v.id=rel.version_id
   where a.id=target_id and public.agentgrid_is_public_agent(a.id);
 elsif target_kind='review' then
  select pg_catalog.jsonb_build_object('kind','review','resourceId',r.agent_id,'resourceSlug',a.slug,
   'usedVersionId',r.used_version_id,'version',v.version,'revision',r.revision,'title',r.title,
   'body',r.body,'experience',r.experience_note,'rating',r.rating)
   into context from public.agentgrid_reviews r join public.agentgrid_agents a on a.id=r.agent_id
   join public.agentgrid_agent_versions v on v.id=r.used_version_id
   where r.id=target_id and public.agentgrid_is_public_review(r.id);
 elsif target_kind='profile' then
  select pg_catalog.jsonb_build_object('kind','profile','username',p.username,'displayName',p.display_name,'bio',p.bio,'website',p.website_url)
   into context from public.agentgrid_profiles p where p.id=target_id and public.agentgrid_is_public_profile(p.id);
 end if;
 if context is null then raise exception 'Report target unavailable' using errcode='42501'; end if;
 insert into public.agentgrid_reports(reporter_id,agent_id,review_id,profile_id,category,explanation)
 values(public.agentgrid_profile_id(),case when target_kind='agent' then target_id end,
  case when target_kind='review' then target_id end,case when target_kind='profile' then target_id end,report_category,details)
 returning id into result;
 insert into public.agentgrid_report_contexts(report_id,snapshot) values(result,context);
 return result;
end; $agentgrid_function$;

create function public.agentgrid_staff_report(report_resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('id',r.id,
  'targetKind',case when r.agent_id is not null then 'agent' when r.review_id is not null then 'review' else 'profile' end,
  'targetId',coalesce(r.agent_id,r.review_id,r.profile_id),'category',r.category,'explanation',r.explanation,
  'state',r.state,'resolution',r.resolution,'resolvedAt',r.resolved_at,'createdAt',r.created_at,
  'conflictOfInterest',r.reporter_id=public.agentgrid_profile_id() or coalesce(a.owner_id,rev.author_id,r.profile_id)=public.agentgrid_profile_id(),
  'context',case when c.report_id is null then null else pg_catalog.jsonb_build_object('capturedAt',c.captured_at,'snapshot',c.snapshot) end)
 into result from public.agentgrid_reports r
 left join public.agentgrid_agents a on a.id=r.agent_id
 left join public.agentgrid_reviews rev on rev.id=r.review_id
 left join public.agentgrid_report_contexts c on c.report_id=r.id
 where r.id=report_resource_id;
 return result;
end; $agentgrid_function$;

create function public.agentgrid_staff_reports(requested_state text,requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare records jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 if requested_state is null or requested_state not in ('open','resolved','dismissed') or requested_offset is null or requested_offset not between 0 and 9999 then
  raise exception 'Bounded moderation request required' using errcode='23514'; end if;
 select coalesce(pg_catalog.jsonb_agg(record order by created_at,id),'[]'::jsonb) into records from (
  select r.created_at,r.id,pg_catalog.jsonb_build_object('id',r.id,
   'targetKind',case when r.agent_id is not null then 'agent' when r.review_id is not null then 'review' else 'profile' end,
   'category',r.category,'state',r.state,'createdAt',r.created_at) as record
  from public.agentgrid_reports r where r.state=requested_state order by r.created_at,r.id limit 21 offset requested_offset
 ) rows;
 return records;
end; $agentgrid_function$;

create function public.agentgrid_decide_report(report_resource_id uuid,decision text,explanation text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare report public.agentgrid_reports%rowtype; target_owner uuid;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 perform public.agentgrid_enforce_quota('moderate-report',120,3600);
 select * into report from public.agentgrid_reports where id=report_resource_id for update;
 if not found then raise exception 'Report unavailable' using errcode='42501'; end if;
 select coalesce((select owner_id from public.agentgrid_agents where id=report.agent_id),
  (select author_id from public.agentgrid_reviews where id=report.review_id),report.profile_id) into target_owner;
 if report.reporter_id=public.agentgrid_profile_id() or target_owner=public.agentgrid_profile_id() then
  raise exception 'An uninvolved moderator must decide this report' using errcode='42501'; end if;
 -- Existing routine atomically refuses an already closed report and records its
 -- immutable audit entry. Closing never silently performs a resource takedown.
 perform public.agentgrid_resolve_report(report_resource_id,decision,explanation);
 return public.agentgrid_staff_report(report_resource_id);
end; $agentgrid_function$;
revoke all on function public.agentgrid_resolve_report(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.agentgrid_staff_reports(text,integer),public.agentgrid_staff_report(uuid),
 public.agentgrid_decide_report(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_reports(text,integer),public.agentgrid_staff_report(uuid),
 public.agentgrid_decide_report(uuid,text,text) to authenticated;
