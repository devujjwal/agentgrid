-- Reporter-only status history; never disclose another reporter's details.
create function public.agentgrid_owned_reports(requested_offset integer default 0,report_resource_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id(); records jsonb;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if requested_offset is null or requested_offset not between 0 and 9999
   or (report_resource_id is not null and requested_offset<>0) then
   raise exception 'Bounded report history required' using errcode='23514'; end if;
 select coalesce(pg_catalog.jsonb_agg(record order by created_at desc,id),'[]'::jsonb) into records from (
  select r.id,r.created_at,pg_catalog.jsonb_build_object(
   'id',r.id,'targetKind',case when r.agent_id is not null then 'agent' when r.review_id is not null then 'review' else 'profile' end,
   'targetId',coalesce(r.agent_id,r.review_id,r.profile_id),'category',r.category,'explanation',r.explanation,
   'state',r.state,'resolution',r.resolution,'resolvedAt',r.resolved_at,'createdAt',r.created_at) as record
  from public.agentgrid_reports r where r.reporter_id=own_profile
   and (report_resource_id is null or r.id=report_resource_id)
  order by r.created_at desc,r.id limit 21 offset requested_offset
 ) rows;
 return records;
end; $agentgrid_function$;
revoke all on function public.agentgrid_owned_reports(integer,uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_owned_reports(integer,uuid) to authenticated;
