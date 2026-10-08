-- Owned version export now includes the exact author-provided guide.
-- Staff publication manifests and host evidence remain in separate private resources.
create or replace function public.agentgrid_owned_version_document(resource_id uuid,resource_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id(); document jsonb;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if resource_id is null or resource_version_id is null then raise exception 'Resource and version required' using errcode='23514'; end if;
 select pg_catalog.jsonb_build_object('resourceId',a.id,'sourceVersionId',a.forked_from_version_id,
  'record',pg_catalog.jsonb_build_object('id',v.id,'version',v.version,'contentDigest',v.content_digest,
    'submittedAt',v.created_at,'state',s.state,'reason',s.reason,'reviewedAt',s.reviewed_at),
  'specification',v.specification,'editorialText',v.editorial::text) into document
 from public.agentgrid_agents a join public.agentgrid_agent_versions v on v.agent_id=a.id
 join public.agentgrid_submissions s on s.version_id=v.id
 where a.id=resource_id and v.id=resource_version_id and a.owner_id=own_profile and v.submitted_by=own_profile;
 if document is null then raise exception 'Owned version required' using errcode='42501'; end if;
 return document;
end; $agentgrid_function$;
revoke all on function public.agentgrid_owned_version_document(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_owned_version_document(uuid,uuid) to authenticated;
