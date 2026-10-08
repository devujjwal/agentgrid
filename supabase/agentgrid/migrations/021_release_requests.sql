-- A staff request is a recorded review intent, not a successful quality gate.
create table public.agentgrid_release_requests (
 id uuid primary key,
 version_id uuid not null references public.agentgrid_agent_versions(id) on delete restrict deferrable initially immediate,
 reviewed_by uuid not null references public.agentgrid_profiles(id) on delete restrict deferrable initially immediate,
 review_request jsonb not null check(pg_catalog.jsonb_typeof(review_request)='object' and pg_catalog.octet_length(review_request::text)<=14000),
 self_review boolean not null,
 created_at timestamptz not null default pg_catalog.now(),
 expires_at timestamptz not null default pg_catalog.now()+interval '7 days'
);
create index agentgrid_release_requests_version on public.agentgrid_release_requests(version_id,created_at,id);
create table public.agentgrid_release_request_outcomes (
 request_id uuid primary key references public.agentgrid_release_requests(id) on delete restrict deferrable initially immediate,
 outcome text not null check(outcome in ('cancelled','released')),
 actor_id uuid not null references public.agentgrid_profiles(id) on delete restrict deferrable initially immediate,
 quality_manifest jsonb,
 created_at timestamptz not null default pg_catalog.now(),
 check((outcome='released')=(quality_manifest is not null))
);
create trigger agentgrid_release_request_immutable before update or delete on public.agentgrid_release_requests
for each row execute function public.agentgrid_deny_immutable_mutation();
create trigger agentgrid_release_outcome_immutable before update or delete on public.agentgrid_release_request_outcomes
for each row execute function public.agentgrid_deny_immutable_mutation();
alter table public.agentgrid_release_requests enable row level security;
alter table public.agentgrid_release_request_outcomes enable row level security;
revoke all on public.agentgrid_release_requests,public.agentgrid_release_request_outcomes from public,anon,authenticated,service_role;
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review','moderate-report','moderate-submission','moderate-resource','record-host-run','request-release'));
create function public.agentgrid_release_request_receipt(request_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$
 select q.review_request || pg_catalog.jsonb_build_object('resourceId',v.agent_id,'selfReview',q.self_review,
 'requestedAt',q.created_at,'expiresAt',q.expires_at,'state',coalesce(o.outcome,'requested'),'decidedAt',o.created_at)
 from public.agentgrid_release_requests q join public.agentgrid_agent_versions v on v.id=q.version_id
 left join public.agentgrid_release_request_outcomes o on o.request_id=q.id where q.id=$1;
$agentgrid_function$;
create function public.agentgrid_staff_release_requests(submitted_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 if not exists(select 1 from public.agentgrid_submissions where version_id=submitted_version_id) then raise exception 'Submission required' using errcode='42501'; end if;
 return pg_catalog.jsonb_build_object('versionId',submitted_version_id,'approvals',coalesce((select pg_catalog.jsonb_agg(public.agentgrid_release_request_receipt(id) order by created_at,id) from public.agentgrid_release_requests where version_id=submitted_version_id),'[]'::jsonb));
end; $agentgrid_function$;
create function public.agentgrid_request_release(review_request jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare existing public.agentgrid_release_requests%rowtype; submitted public.agentgrid_agent_versions%rowtype;
 resource public.agentgrid_agents%rowtype; request_id uuid; release_id uuid; ids uuid[]; current_state text;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 if review_request is null or pg_catalog.jsonb_typeof(review_request) is distinct from 'object' or pg_catalog.octet_length(review_request::text)>14000 then raise exception 'Bounded review required' using errcode='23514'; end if;
 if not review_request ?& array['requestId','versionId','expectedDigest','expectedResourceRevision','expectedReleaseId','evidenceIds','checks','explanation']
 or (select count(*) from pg_catalog.jsonb_object_keys(review_request))<>8
 or pg_catalog.jsonb_typeof(review_request->'explanation') is distinct from 'string' or char_length(btrim(review_request->>'explanation')) not between 80 and 2400
 or pg_catalog.jsonb_typeof(review_request->'evidenceIds') is distinct from 'array'
 or pg_catalog.jsonb_typeof(review_request->'requestId') is distinct from 'string'
 or pg_catalog.jsonb_typeof(review_request->'versionId') is distinct from 'string'
 or pg_catalog.jsonb_typeof(review_request->'expectedDigest') is distinct from 'string' or (review_request->>'expectedDigest') !~ '^[a-f0-9]{64}$'
 or pg_catalog.jsonb_typeof(review_request->'expectedResourceRevision') is distinct from 'number' or (review_request->>'expectedResourceRevision') !~ '^[0-9]+$'
 or pg_catalog.jsonb_typeof(review_request->'expectedReleaseId') not in ('null','string')
 or review_request->'checks' is distinct from '{"standaloneValue":true,"sourceAccuracy":true,"platformEvidence":true,"privacyAndSecurity":true,"distributionAndCosts":true,"reuseRights":true}'::jsonb
 then raise exception 'Explicit complete staff review required' using errcode='23514'; end if;
 request_id:=(review_request->>'requestId')::uuid;
 if request_id is null then raise exception 'Request identity required' using errcode='23514'; end if;
 select * into existing from public.agentgrid_release_requests where id=request_id;
 if found then
  if existing.reviewed_by is distinct from public.agentgrid_profile_id() or existing.review_request is distinct from review_request then raise exception 'Review request changed' using errcode='40001'; end if;
  return public.agentgrid_release_request_receipt(request_id);
 end if;
 perform public.agentgrid_enforce_quota('request-release',60,3600);
 if pg_catalog.jsonb_array_length(review_request->'evidenceIds') not between 3 and 40 then raise exception 'Bounded selected evidence required' using errcode='23514'; end if;
 select array_agg(value::uuid) into ids from pg_catalog.jsonb_array_elements_text(review_request->'evidenceIds');
 if (select count(distinct id) from unnest(ids) id)<>cardinality(ids) then raise exception 'Distinct evidence required' using errcode='23514'; end if;
 select * into submitted from public.agentgrid_agent_versions where id=(review_request->>'versionId')::uuid;
 if not found then raise exception 'Submission required' using errcode='42501'; end if;
 select * into resource from public.agentgrid_agents where id=submitted.agent_id for update;
 if resource.status<>'active' or not exists(select 1 from public.agentgrid_profiles where id=resource.owner_id and status='active')
 or (submitted.submitted_by=public.agentgrid_profile_id() and not public.agentgrid_has_role(array['administrator'])) then
 raise exception 'Active resource and independent staff or explicit administrator review required' using errcode='42501'; end if;
 select state into current_state from public.agentgrid_submissions where version_id=submitted.id for update;
 select version_id into release_id from public.agentgrid_releases where agent_id=resource.id;
 if current_state is distinct from 'pending' or submitted.content_digest is distinct from review_request->>'expectedDigest'
 or resource.moderation_revision is distinct from (review_request->>'expectedResourceRevision')::integer
 or release_id is distinct from (review_request->>'expectedReleaseId')::uuid then raise exception 'Submission or resource changed' using errcode='40001'; end if;
 if (select count(*) from public.agentgrid_host_verification_runs where id=any(ids) and version_id=submitted.id and content_digest=submitted.content_digest)<>cardinality(ids) then
 raise exception 'Evidence must belong to this exact version' using errcode='23514'; end if;
 if (select count(*) from public.agentgrid_release_requests where version_id=submitted.id)>=20 then raise exception 'Version request limit reached' using errcode='23514'; end if;
 insert into public.agentgrid_release_requests(id,version_id,reviewed_by,review_request,self_review)
 values(request_id,submitted.id,public.agentgrid_profile_id(),review_request,submitted.submitted_by=public.agentgrid_profile_id());
 return public.agentgrid_release_request_receipt(request_id);
end; $agentgrid_function$;
create function public.agentgrid_cancel_release_request(request_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare outcome text;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 if not exists(select 1 from public.agentgrid_release_requests where id=request_id) then raise exception 'Review required' using errcode='42501'; end if;
 select o.outcome into outcome from public.agentgrid_release_request_outcomes o where o.request_id=agentgrid_cancel_release_request.request_id;
 if outcome='released' then raise exception 'Already released; use resource moderation' using errcode='40001'; end if;
 if outcome is null then
 insert into public.agentgrid_release_request_outcomes(request_id,outcome,actor_id) values(request_id,'cancelled',public.agentgrid_profile_id());
 end if;
 return public.agentgrid_release_request_receipt(request_id);
end; $agentgrid_function$;
revoke all on function public.agentgrid_release_request_receipt(uuid),public.agentgrid_staff_release_requests(uuid),
 public.agentgrid_request_release(jsonb),public.agentgrid_cancel_release_request(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_release_requests(uuid),public.agentgrid_request_release(jsonb),public.agentgrid_cancel_release_request(uuid) to authenticated;
