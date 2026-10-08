-- Private observations are evidence inputs, never approval flags or public activity.
create table public.agentgrid_host_verification_runs (
 id uuid primary key,
 version_id uuid not null references public.agentgrid_agent_versions(id) on delete restrict deferrable initially immediate,
 recorded_by uuid not null references public.agentgrid_profiles(id) on delete restrict deferrable initially immediate,
 content_digest text not null check(content_digest ~ '^[a-f0-9]{64}$'),
 run jsonb not null check(pg_catalog.jsonb_typeof(run)='object' and pg_catalog.octet_length(run::text)<=60000),
 created_at timestamptz not null default pg_catalog.now()
);
create index agentgrid_host_verification_version on public.agentgrid_host_verification_runs(version_id,created_at,id);
create trigger agentgrid_host_verification_immutable before update or delete on public.agentgrid_host_verification_runs
for each row execute function public.agentgrid_deny_immutable_mutation();
alter table public.agentgrid_host_verification_runs enable row level security;
revoke all on public.agentgrid_host_verification_runs from public,anon,authenticated,service_role;
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review','moderate-report','moderate-submission','moderate-resource','record-host-run'));
create function public.agentgrid_host_run_receipt(record_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$
 select pg_catalog.jsonb_build_object('id',id,'versionId',version_id,'contentDigest',content_digest,'recordedAt',created_at,'run',run)
 from public.agentgrid_host_verification_runs where id=record_id;
$agentgrid_function$;
create function public.agentgrid_staff_host_runs(submitted_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare rows jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 if not exists(select 1 from public.agentgrid_submissions where version_id=submitted_version_id) then raise exception 'Submission required' using errcode='42501'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'versionId',version_id,'contentDigest',content_digest,'recordedAt',created_at,'platform',run->>'platform_slug','scenario',run->>'scenario','completedOn',run->>'completed_on','failedChecks',(select count(*) from pg_catalog.jsonb_array_elements(run->'assertions') item where item->'passed'='false'::jsonb)) order by created_at,id),'[]'::jsonb) into rows
 from public.agentgrid_host_verification_runs where version_id=submitted_version_id;
 return pg_catalog.jsonb_build_object('versionId',submitted_version_id,'runs',rows);
end; $agentgrid_function$;
create function public.agentgrid_record_host_run(record_id uuid,submitted_version_id uuid,expected_digest text,observation jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare existing public.agentgrid_host_verification_runs%rowtype; actual_digest text; specification jsonb; current_state text;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 select * into existing from public.agentgrid_host_verification_runs where id=record_id;
 if found then
  if existing.version_id is distinct from submitted_version_id or existing.recorded_by is distinct from public.agentgrid_profile_id()
   or existing.content_digest is distinct from expected_digest or existing.run is distinct from observation then
   raise exception 'Evidence request changed' using errcode='40001'; end if;
  return public.agentgrid_host_run_receipt(record_id);
 end if;
 perform public.agentgrid_enforce_quota('record-host-run',120,3600);
 select v.content_digest,v.specification,s.state into actual_digest,specification,current_state
 from public.agentgrid_agent_versions v join public.agentgrid_submissions s on s.version_id=v.id
 join public.agentgrid_agents a on a.id=v.agent_id join public.agentgrid_profiles p on p.id=a.owner_id
 where v.id=submitted_version_id and a.status='active' and p.status='active' for update of s;
 if not found then raise exception 'Active submitted resource required' using errcode='42501'; end if;
 if current_state<>'pending' or expected_digest is distinct from actual_digest then raise exception 'Submission changed' using errcode='40001'; end if;
 if record_id is null or observation is null or pg_catalog.jsonb_typeof(observation) is distinct from 'object'
 or pg_catalog.octet_length(observation::text)>60000 or observation->>'origin' is distinct from 'real-host'
 or observation->>'scenario' is null or observation->>'scenario' not in ('normal','ambiguous-input','adversarial-input')
 or not exists(select 1 from pg_catalog.jsonb_array_elements(specification->'platforms') platform where platform->>'slug'=observation->>'platform_slug')
 then raise exception 'Bounded declared host observation required' using errcode='23514'; end if;
 -- Staff can invoke RPCs directly; reject malformed/extra fields before retention.
 if (select count(*) from pg_catalog.jsonb_object_keys(observation))<>10
 or not observation ?& array['origin','platform_slug','host_version','scenario','specification_sha256','completed_on','input','observed_output','assertions','reviewer_notes']
 or pg_catalog.jsonb_typeof(observation->'host_version') is distinct from 'string' or char_length(btrim(observation->>'host_version')) not between 3 and 160
 or pg_catalog.jsonb_typeof(observation->'specification_sha256') is distinct from 'string' or (observation->>'specification_sha256') !~ '^[a-f0-9]{64}$'
 or pg_catalog.jsonb_typeof(observation->'completed_on') is distinct from 'string' or (observation->>'completed_on') !~ '^\d{4}-\d{2}-\d{2}$'
 or pg_catalog.jsonb_typeof(observation->'input') is distinct from 'string' or char_length(btrim(observation->>'input')) not between 80 and 8000
 or pg_catalog.jsonb_typeof(observation->'observed_output') is distinct from 'string' or char_length(btrim(observation->>'observed_output')) not between 80 and 16000
 or pg_catalog.jsonb_typeof(observation->'reviewer_notes') is distinct from 'string' or char_length(btrim(observation->>'reviewer_notes')) not between 80 and 1600
 or pg_catalog.jsonb_typeof(observation->'assertions') is distinct from 'array'
 then raise exception 'Complete host observation required' using errcode='23514'; end if;
 if pg_catalog.jsonb_array_length(observation->'assertions') not between 2 and 12
 or exists(select 1 from pg_catalog.jsonb_array_elements(observation->'assertions') item
 where pg_catalog.jsonb_typeof(item) is distinct from 'object' or not item ?& array['description','passed']
 or pg_catalog.jsonb_typeof(item->'description') is distinct from 'string' or char_length(btrim(item->>'description')) not between 24 and 600
 or pg_catalog.jsonb_typeof(item->'passed') is distinct from 'boolean')
 then raise exception 'Explicit observed assertions required' using errcode='23514'; end if;
 if exists(select 1 from pg_catalog.jsonb_array_elements(observation->'assertions') item where (select count(*) from pg_catalog.jsonb_object_keys(item))<>2)
 then raise exception 'Unknown assertion fields' using errcode='23514'; end if;
 if (select count(*) from public.agentgrid_host_verification_runs where version_id=submitted_version_id)>=60 then
 raise exception 'Version evidence limit reached' using errcode='23514'; end if;
 insert into public.agentgrid_host_verification_runs(id,version_id,recorded_by,content_digest,run)
 values(record_id,submitted_version_id,public.agentgrid_profile_id(),actual_digest,observation);
 return public.agentgrid_host_run_receipt(record_id);
end; $agentgrid_function$;
revoke all on function public.agentgrid_host_run_receipt(uuid),public.agentgrid_staff_host_runs(uuid),
 public.agentgrid_record_host_run(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_host_runs(uuid),public.agentgrid_record_host_run(uuid,uuid,text,jsonb) to authenticated;

create function public.agentgrid_staff_host_run(record_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 return public.agentgrid_host_run_receipt(record_id);
end; $agentgrid_function$;
revoke all on function public.agentgrid_staff_host_run(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_host_run(uuid) to authenticated;
