-- Live, bounded review projections; no private identity or moderation authority.
create function public.agentgrid_owned_review(resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare own_profile uuid:=public.agentgrid_profile_id(); record jsonb;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if resource_id is null then raise exception 'Resource required' using errcode='23514'; end if;
 select pg_catalog.jsonb_build_object(
  'id',r.id,'resourceId',r.agent_id,'usedVersionId',r.used_version_id,'version',v.version,
  'rating',r.rating,'title',r.title,'body',r.body,'experience',r.experience_note,'revision',r.revision,
  'createdAt',r.created_at,'updatedAt',r.updated_at,'state',m.state,'reason',m.reason,'reviewedAt',m.reviewed_at
 ) into record from public.agentgrid_reviews r
 join public.agentgrid_agent_versions v on v.id=r.used_version_id and v.agent_id=r.agent_id
 join public.agentgrid_review_moderation m on m.review_id=r.id
 where r.agent_id=resource_id and r.author_id=own_profile;
 return record;
end; $agentgrid_function$;
revoke all on function public.agentgrid_owned_review(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_owned_review(uuid) to authenticated;

create function public.agentgrid_public_reviews(resource_id uuid,requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare records jsonb; rating jsonb;
begin
 if resource_id is null or requested_offset is null or requested_offset not between 0 and 9999 then
  raise exception 'Bounded public review request required' using errcode='23514'; end if;
 if not public.agentgrid_is_public_agent(resource_id) then return null; end if;
 select pg_catalog.jsonb_build_object('reviewCount',review_count,'averageRating',average_rating) into rating
 from public.agentgrid_public_rating(resource_id);
 select coalesce(pg_catalog.jsonb_agg(record order by created_at desc,id),'[]'::jsonb) into records from (
  select r.id,r.created_at,pg_catalog.jsonb_build_object(
   'id',r.id,'usedVersionId',r.used_version_id,'version',v.version,'rating',r.rating,
   'title',r.title,'body',r.body,'experience',r.experience_note,'createdAt',r.created_at,'updatedAt',r.updated_at,
   'author',pg_catalog.jsonb_build_object('name',b.display_name,'username',b.username)
  ) as record from public.agentgrid_reviews r
  join public.agentgrid_agent_versions v on v.id=r.used_version_id and v.agent_id=r.agent_id
  cross join lateral public.agentgrid_public_review_byline(r.id) b
  where r.agent_id=resource_id and public.agentgrid_is_public_review(r.id)
  order by r.created_at desc,r.id limit 21 offset requested_offset
 ) rows;
 return rating || pg_catalog.jsonb_build_object('resourceId',resource_id,'reviews',records);
end; $agentgrid_function$;
revoke all on function public.agentgrid_public_reviews(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_public_reviews(uuid,integer) to anon,authenticated;
