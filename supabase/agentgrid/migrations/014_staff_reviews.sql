-- Staff review decisions use both content and moderation revisions. No shared
-- authentication/application resource is changed, and no role is granted here.
alter table public.agentgrid_review_moderation add column decision_revision integer not null default 0 check(decision_revision>=0);
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review'));

create function public.agentgrid_staff_review(review_resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then
  raise exception 'Moderator required' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object(
  'id',r.id,'resourceId',r.agent_id,'resourceSlug',a.slug,
  'resourceAvailable',public.agentgrid_is_public_agent(a.id),
  'authorActive',p.status='active','authorIsSelf',r.author_id=public.agentgrid_profile_id(),
  'usedVersionId',r.used_version_id,'version',v.version,
  'rating',r.rating,'title',r.title,'body',r.body,'experience',r.experience_note,
  'revision',r.revision,'decisionRevision',m.decision_revision,
  'state',case when r.author_withdrawn_at is not null then 'withdrawn' else m.state end,
  'reason',m.reason,'reviewedAt',m.reviewed_at,'withdrawnAt',r.author_withdrawn_at,
  'createdAt',r.created_at,'updatedAt',r.updated_at
 ) into result from public.agentgrid_reviews r
 join public.agentgrid_agents a on a.id=r.agent_id
 join public.agentgrid_profiles p on p.id=r.author_id
 join public.agentgrid_agent_versions v on v.id=r.used_version_id and v.agent_id=r.agent_id
 join public.agentgrid_review_moderation m on m.review_id=r.id
 where r.id=review_resource_id;
 return result;
end; $agentgrid_function$;

create function public.agentgrid_staff_reviews(requested_state text, requested_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare records jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then
  raise exception 'Moderator required' using errcode='42501'; end if;
 if requested_state is null or requested_state not in ('pending','published','hidden')
   or requested_offset is null or requested_offset not between 0 and 9999 then
  raise exception 'Bounded moderation request required' using errcode='23514'; end if;
 select coalesce(pg_catalog.jsonb_agg(record order by created_at,id),'[]'::jsonb) into records from (
  select r.created_at,r.id,pg_catalog.jsonb_build_object(
   'id',r.id,'resourceId',r.agent_id,'resourceSlug',a.slug,'title',r.title,
   'state',m.state,'revision',r.revision,'decisionRevision',m.decision_revision,'createdAt',r.created_at
  ) as record from public.agentgrid_reviews r
  join public.agentgrid_review_moderation m on m.review_id=r.id
  join public.agentgrid_agents a on a.id=r.agent_id
  where m.state=requested_state and r.author_withdrawn_at is null
  order by r.created_at,r.id limit 21 offset requested_offset
 ) rows;
 return records;
end; $agentgrid_function$;

create function public.agentgrid_decide_review(review_resource_id uuid, expected_revision integer,
 expected_decision_revision integer, decision text, explanation text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare review public.agentgrid_reviews%rowtype; moderation public.agentgrid_review_moderation%rowtype;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then
  raise exception 'Moderator required' using errcode='42501'; end if;
 perform public.agentgrid_enforce_quota('moderate-review',120,3600);
 select * into review from public.agentgrid_reviews where id=review_resource_id for update;
 if not found then raise exception 'Review unavailable' using errcode='42501'; end if;
 select * into moderation from public.agentgrid_review_moderation where review_id=review.id for update;
 if not found then raise exception 'Review unavailable' using errcode='42501'; end if;
 if expected_revision is distinct from review.revision
   or expected_decision_revision is distinct from moderation.decision_revision then
  raise exception 'Review or moderation decision changed; reload first' using errcode='40001'; end if;
 if moderation.decision_revision>=2147483646 then raise exception 'Review unavailable' using errcode='23514'; end if;
 -- The internal routine preserves self-moderation/withdrawal/publication guards
 -- and writes its immutable audit entry in this same transaction.
 perform public.agentgrid_moderate_review(review_resource_id,expected_revision,decision,explanation);
 update public.agentgrid_review_moderation set decision_revision=decision_revision+1 where review_id=review.id;
 return public.agentgrid_staff_review(review.id);
end; $agentgrid_function$;

-- Staff must use the compare-and-set entry point; the prior routine is internal.
revoke all on function public.agentgrid_moderate_review(uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function public.agentgrid_staff_review(uuid),public.agentgrid_staff_reviews(text,integer),
 public.agentgrid_decide_review(uuid,integer,integer,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_review(uuid),public.agentgrid_staff_reviews(text,integer),
 public.agentgrid_decide_review(uuid,integer,integer,text,text) to authenticated;
