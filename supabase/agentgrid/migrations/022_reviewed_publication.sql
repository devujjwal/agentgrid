-- Offline publisher only: no privileged credential is introduced into the browser.
-- Revalidate mutable eligibility both when preparing and atomically when releasing.
create function public.agentgrid_assert_release_request(request_id uuid)
returns void language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare q public.agentgrid_release_requests%rowtype; v public.agentgrid_agent_versions%rowtype;
 a public.agentgrid_agents%rowtype; release_id uuid;
begin
 select * into q from public.agentgrid_release_requests where id=request_id;
 if not found then raise exception 'Review unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.agentgrid_release_request_outcomes o where o.request_id=q.id) or q.expires_at<=pg_catalog.now() then raise exception 'Review closed or expired' using errcode='40001'; end if;
 if not exists(select 1 from public.agentgrid_user_roles r join public.agentgrid_profiles p on p.id=r.user_id
 join public.agentgrid_identities i on i.profile_id=p.id
 where r.user_id=q.reviewed_by and p.status='active' and r.role=any(case when q.self_review then array['administrator'] else array['administrator','moderator'] end)) then
 raise exception 'Reviewer authority no longer active' using errcode='42501'; end if;
 select * into v from public.agentgrid_agent_versions where id=q.version_id;
 select * into a from public.agentgrid_agents where id=v.agent_id;
 select version_id into release_id from public.agentgrid_releases where agent_id=a.id;
 if a.status<>'active' or not exists(select 1 from public.agentgrid_profiles where id=a.owner_id and status='active') then raise exception 'Active resource required' using errcode='42501'; end if;
 if v.content_digest is distinct from q.review_request->>'expectedDigest'
 or a.moderation_revision is distinct from (q.review_request->>'expectedResourceRevision')::integer
 or release_id is distinct from (q.review_request->>'expectedReleaseId')::uuid
 or not exists(select 1 from public.agentgrid_submissions where version_id=v.id and state='pending') then
 raise exception 'Reviewed state changed' using errcode='40001'; end if;
end; $agentgrid_function$;
create function public.agentgrid_prepare_release_request(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$ begin
 perform public.agentgrid_assert_release_request(request_id);
 return (select pg_catalog.jsonb_build_object('approval',public.agentgrid_release_request_receipt(q.id),
 'specification',v.specification,'editorial',v.editorial,
 'observations',(select pg_catalog.jsonb_agg(public.agentgrid_host_run_receipt(e.id) order by e.ordinality)
 from (select value::uuid id,ordinality from pg_catalog.jsonb_array_elements_text(q.review_request->'evidenceIds') with ordinality) e))
 from public.agentgrid_release_requests q join public.agentgrid_agent_versions v on v.id=q.version_id where q.id=request_id);
end; $agentgrid_function$;
create function public.agentgrid_execute_release_request(request_id uuid,evidence jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare q public.agentgrid_release_requests%rowtype; o public.agentgrid_release_request_outcomes%rowtype;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 select * into q from public.agentgrid_release_requests where id=request_id;
 if not found then raise exception 'Review unavailable' using errcode='42501'; end if;
 -- Acknowledgement recovery returns the historical receipt, never republishes an old version.
 select * into o from public.agentgrid_release_request_outcomes where agentgrid_release_request_outcomes.request_id=q.id;
 if found then
  if o.outcome is distinct from 'released' or o.quality_manifest is distinct from evidence then raise exception 'Closed review differs' using errcode='40001'; end if;
  return public.agentgrid_release_request_receipt(q.id);
 end if;
 perform 1 from public.agentgrid_agents where id=(select agent_id from public.agentgrid_agent_versions where id=q.version_id) for update;
 perform 1 from public.agentgrid_submissions where version_id=q.version_id for update;
 perform public.agentgrid_assert_release_request(q.id);
 if evidence is null or pg_catalog.jsonb_typeof(evidence) is distinct from 'object'
 or pg_catalog.octet_length(evidence::text)>32000
 or pg_catalog.jsonb_typeof(evidence->'host_run_sha256') is distinct from 'array'
 then raise exception 'Prepared evidence required' using errcode='23514'; end if;
 if pg_catalog.jsonb_array_length(evidence->'host_run_sha256')<>pg_catalog.jsonb_array_length(q.review_request->'evidenceIds')
 or exists(select 1 from pg_catalog.jsonb_array_elements_text(evidence->'host_run_sha256') h where h !~ '^[a-f0-9]{64}$')
 or evidence->>'specification_sha256' is null or evidence->>'specification_sha256' !~ '^[a-f0-9]{64}$'
 or evidence->>'editorial_sha256' is null or evidence->>'editorial_sha256' !~ '^[a-f0-9]{64}$'
 then raise exception 'Complete quality manifest required' using errcode='23514'; end if;
 perform public.agentgrid_publish_version(q.version_id,q.reviewed_by,q.review_request->>'expectedDigest',evidence);
 insert into public.agentgrid_release_request_outcomes(request_id,outcome,actor_id,quality_manifest)
 values(q.id,'released',q.reviewed_by,evidence);
 return public.agentgrid_release_request_receipt(q.id);
end; $agentgrid_function$;
-- Close the legacy shortcut: even the trusted publisher must use a persisted staff request.
revoke all on function public.agentgrid_publish_version(uuid,uuid,text,jsonb),public.agentgrid_assert_release_request(uuid),
 public.agentgrid_prepare_release_request(uuid),public.agentgrid_execute_release_request(uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_prepare_release_request(uuid),public.agentgrid_execute_release_request(uuid,jsonb) to service_role;
-- Read-only recovery for an interrupted trusted job; does not revive closed reviews.
create function public.agentgrid_release_request_status(request_id uuid)
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$ select public.agentgrid_release_request_receipt(request_id); $agentgrid_function$;
revoke all on function public.agentgrid_release_request_status(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_release_request_status(uuid) to service_role;
