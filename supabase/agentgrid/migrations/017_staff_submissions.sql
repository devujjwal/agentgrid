-- Staff inspect immutable submitted bundles, never a creator's working draft.
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review','moderate-report','moderate-submission'));
create index agentgrid_submissions_staff_queue on public.agentgrid_submissions(state,created_at,version_id);
create function public.agentgrid_staff_submission(submitted_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object(
 'versionId',v.id,'resourceId',a.id,'slug',a.slug,
 'name',left(coalesce(nullif(btrim(v.specification#>>'{identity,name}'),''),a.slug),100),
 'version',v.version,'state',s.state,'submittedAt',s.created_at,
 'reason',s.reason,'reviewedAt',s.reviewed_at,'contentDigest',v.content_digest,
 'sourceVersionId',a.forked_from_version_id,'resourceStatus',a.status,'authorStatus',p.status,
 'authorIsSelf',a.owner_id=public.agentgrid_profile_id(),
 'specificationText',v.specification::text,'editorialText',v.editorial::text)
 into result from public.agentgrid_submissions s
 join public.agentgrid_agent_versions v on v.id=s.version_id
 join public.agentgrid_agents a on a.id=v.agent_id
 join public.agentgrid_profiles p on p.id=a.owner_id where s.version_id=submitted_version_id;
 return result;
end; $agentgrid_function$;
create function public.agentgrid_staff_submissions(requested_state text,requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 if requested_state is null or requested_state not in ('pending','approved','rejected','withdrawn')
 or requested_offset is null or requested_offset not between 0 and 9999 then raise exception 'Invalid queue' using errcode='23514'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
 'versionId',q.version_id,'resourceId',q.agent_id,'slug',q.slug,'name',q.name,
 'version',q.version,'state',q.state,'submittedAt',q.created_at)
 order by q.created_at,q.version_id),'[]'::jsonb) into result from (
 select s.version_id,v.agent_id,a.slug,left(coalesce(nullif(btrim(v.specification#>>'{identity,name}'),''),a.slug),100) as name,
 v.version,s.state,s.created_at from public.agentgrid_submissions s
 join public.agentgrid_agent_versions v on v.id=s.version_id join public.agentgrid_agents a on a.id=v.agent_id
 where s.state=requested_state order by s.created_at,s.version_id limit 21 offset requested_offset
 ) q;
 return result;
end; $agentgrid_function$;

-- Keep the creator withdrawal RPC; staff rejection now requires a bounded,
-- digest-bound decision and a separate uninvolved reviewer.
create or replace function public.agentgrid_decide_submission(submitted_version_id uuid,decision text,explanation text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare owner uuid; current_state text;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 perform 1 from public.agentgrid_profiles where id=public.agentgrid_profile_id() for update;
 select a.owner_id,s.state into owner,current_state from public.agentgrid_submissions s
 join public.agentgrid_agent_versions v on v.id=s.version_id join public.agentgrid_agents a on a.id=v.agent_id
 where s.version_id=submitted_version_id for update of s;
 if not found or current_state<>'pending' or decision is distinct from 'withdrawn' or owner<>public.agentgrid_profile_id() then
  raise exception 'Owned pending withdrawal required' using errcode='42501'; end if;
 if explanation is null or char_length(btrim(explanation)) not between 20 and 2400 then
  raise exception 'A clear decision reason is required' using errcode='23514'; end if;
 update public.agentgrid_submissions set state='withdrawn',reason=explanation,
 reviewed_by=public.agentgrid_profile_id(),reviewed_at=pg_catalog.now() where version_id=submitted_version_id;
end; $agentgrid_function$;
create function public.agentgrid_reject_submission(submitted_version_id uuid,expected_digest text,explanation text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare owner uuid; current_state text; actual_digest text;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 perform public.agentgrid_enforce_quota('moderate-submission',120,3600);
 select a.owner_id,s.state,v.content_digest into owner,current_state,actual_digest from public.agentgrid_submissions s
 join public.agentgrid_agent_versions v on v.id=s.version_id join public.agentgrid_agents a on a.id=v.agent_id
 where s.version_id=submitted_version_id for update of s;
 if not found or owner=public.agentgrid_profile_id() then raise exception 'Uninvolved staff required' using errcode='42501'; end if;
 if current_state<>'pending' or expected_digest is distinct from actual_digest then
  raise exception 'Submission changed; reload' using errcode='40001'; end if;
 if explanation is null or char_length(btrim(explanation)) not between 20 and 2400 then
  raise exception 'A clear decision reason is required' using errcode='23514'; end if;
 update public.agentgrid_submissions set state='rejected',reason=explanation,
 reviewed_by=public.agentgrid_profile_id(),reviewed_at=pg_catalog.now() where version_id=submitted_version_id;
 return public.agentgrid_staff_submission(submitted_version_id);
end; $agentgrid_function$;
revoke all on function public.agentgrid_staff_submission(uuid),public.agentgrid_staff_submissions(text,integer),
 public.agentgrid_reject_submission(uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_submission(uuid),public.agentgrid_staff_submissions(text,integer),
 public.agentgrid_reject_submission(uuid,text,text) to authenticated;
