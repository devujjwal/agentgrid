-- Live creator history is independent from batch-published public content.
-- This projection exposes neither another creator's ledger nor immutable
-- instruction/editorial bodies. Staff have no additional creator authority.
create function public.agentgrid_owned_versions(resource_id uuid,requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id(); resource public.agentgrid_agents%rowtype; versions jsonb;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if resource_id is null or requested_offset is null or requested_offset not between 0 and 9999 then
  raise exception 'Invalid history request' using errcode='23514'; end if;
 select * into resource from public.agentgrid_agents where id=resource_id and owner_id=own_profile;
 if not found then raise exception 'Owned resource required' using errcode='42501'; end if;
 select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
  'id',v.id,'version',v.version,'contentDigest',v.content_digest,
  'submittedAt',v.created_at,'state',v.state,'reason',v.reason,'reviewedAt',v.reviewed_at
 ) order by v.created_at desc,v.id),'[]'::jsonb) into versions from (
  select av.id,av.version,av.content_digest,av.created_at,s.state,s.reason,s.reviewed_at
  from public.agentgrid_agent_versions av join public.agentgrid_submissions s on s.version_id=av.id
  where av.agent_id=resource.id and av.submitted_by=own_profile
  order by av.created_at desc,av.id limit 21 offset requested_offset
 ) v;
 return pg_catalog.jsonb_build_object('versions',versions,'pendingVersionId',(
  select av.id from public.agentgrid_agent_versions av join public.agentgrid_submissions s on s.version_id=av.id
  where av.agent_id=resource.id and av.submitted_by=own_profile and s.state='pending'
  order by av.created_at desc,av.id limit 1
 ),'latestVersion',(
  select av.version from public.agentgrid_agent_versions av
  where av.agent_id=resource.id and av.submitted_by=own_profile
  order by pg_catalog.string_to_array(av.version,'.')::numeric[] desc limit 1
 ),'submissionEnabled',
  resource.status='active' and exists(select 1 from public.agentgrid_configuration where singleton and submission_enabled));
end; $agentgrid_function$;
revoke all on function public.agentgrid_owned_versions(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_owned_versions(uuid,integer) to authenticated;
