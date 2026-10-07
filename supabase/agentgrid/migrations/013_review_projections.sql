-- Author withdrawal is independent of staff moderation and survives resource takedowns.
alter table public.agentgrid_reviews add column author_withdrawn_at timestamptz;
create table public.agentgrid_review_withdrawals (
 id uuid primary key default pg_catalog.gen_random_uuid(),
 review_id uuid not null references public.agentgrid_reviews(id) on delete restrict deferrable initially immediate,
 author_id uuid not null references public.agentgrid_profiles(id) on delete restrict deferrable initially immediate,
 revision integer not null check(revision>1),
 created_at timestamptz not null default pg_catalog.now(),
 unique(review_id,revision)
);
alter table public.agentgrid_review_withdrawals enable row level security;
revoke all on public.agentgrid_review_withdrawals from public,anon,authenticated,service_role;
grant select on public.agentgrid_review_withdrawals to authenticated;
create policy agentgrid_review_withdrawals_owner on public.agentgrid_review_withdrawals for select to authenticated
 using(public.agentgrid_is_member() and author_id=public.agentgrid_profile_id());
create policy agentgrid_review_withdrawals_staff on public.agentgrid_review_withdrawals for select to authenticated
 using(public.agentgrid_has_role(array['moderator','administrator']));
create trigger agentgrid_review_withdrawals_immutable before update or delete on public.agentgrid_review_withdrawals
 for each row execute function public.agentgrid_deny_immutable_mutation();

create or replace function public.agentgrid_is_public_review(review_resource_id uuid)
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select exists(select 1 from public.agentgrid_reviews r join public.agentgrid_review_moderation m on m.review_id=r.id
 join public.agentgrid_profiles p on p.id=r.author_id where r.id=review_resource_id and m.state='published'
 and r.author_withdrawn_at is null and p.status='active' and public.agentgrid_is_public_agent(r.agent_id));
$agentgrid_function$;
create or replace function public.agentgrid_public_rating(resource_id uuid)
returns table(review_count bigint,average_rating numeric) language sql stable security definer set search_path=''
as $agentgrid_function$
 select count(*),round(avg(r.rating),2) from public.agentgrid_reviews r
 where r.agent_id=resource_id and public.agentgrid_is_public_review(r.id);
$agentgrid_function$;

create function public.agentgrid_withdraw_review(resource_id uuid,expected_revision integer)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id(); record public.agentgrid_reviews%rowtype;
begin
 perform public.agentgrid_enforce_quota('review',20,3600);
 perform 1 from public.agentgrid_profiles where id=actor for update;
 select * into record from public.agentgrid_reviews where agent_id=resource_id and author_id=actor for update;
 if not found then raise exception 'Owned review unavailable' using errcode='42501'; end if;
 if record.revision is distinct from expected_revision or record.author_withdrawn_at is not null then
  raise exception 'Review changed; reload before withdrawal' using errcode='40001'; end if;
 update public.agentgrid_reviews set author_withdrawn_at=pg_catalog.now(),updated_at=pg_catalog.now(),revision=revision+1 where id=record.id;
 insert into public.agentgrid_review_withdrawals(review_id,author_id,revision) values(record.id,actor,record.revision+1);
 return record.id;
end; $agentgrid_function$;
revoke all on function public.agentgrid_withdraw_review(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_withdraw_review(uuid,integer) to authenticated;

create or replace function public.agentgrid_write_review(resource_id uuid, used_version uuid, requested_rating smallint,
 requested_title text, requested_body text, experience text, expected_revision integer default 0)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare review_resource_id uuid; actor uuid:=public.agentgrid_profile_id(); resource public.agentgrid_agents%rowtype; current_revision integer;
begin
 perform public.agentgrid_enforce_quota('review',20,3600);
 -- Use the same profile-before-resource lock order as account deactivation.
 perform 1 from public.agentgrid_profiles where id=actor for update;
 select * into resource from public.agentgrid_agents where id=resource_id for share;
 if not found or not public.agentgrid_is_public_agent(resource_id) or not public.agentgrid_is_public_version(used_version)
   or not exists(select 1 from public.agentgrid_agent_versions where id=used_version and agent_id=resource_id)
   or resource.owner_id=actor then raise exception 'Review requires another creator''s public resource' using errcode='42501'; end if;
 -- One authoritative row per member/resource, locked for concurrent edits.
 -- Serialize on the member row so two initial writes cannot both pass revision 0.
 select id,revision into review_resource_id,current_revision from public.agentgrid_reviews
 where agent_id=resource_id and author_id=actor for update;
 if (found and current_revision is distinct from expected_revision)
   or (not found and expected_revision is distinct from 0) then
   raise exception 'Review changed; reload before saving' using errcode='40001';
 end if;
 if review_resource_id is null then
   insert into public.agentgrid_reviews(agent_id,author_id,used_version_id,rating,title,body,experience_note)
   values(resource_id,actor,used_version,requested_rating,requested_title,requested_body,experience) returning id into review_resource_id;
   insert into public.agentgrid_review_moderation(review_id) values(review_resource_id);
 else
   update public.agentgrid_reviews set used_version_id=used_version,rating=requested_rating,title=requested_title,
   body=requested_body,experience_note=experience,author_withdrawn_at=null,revision=revision+1,updated_at=pg_catalog.now() where id=review_resource_id;
   update public.agentgrid_review_moderation set state='pending',reason='',reviewed_by=null,reviewed_at=null where review_id=review_resource_id;
 end if;
 return review_resource_id;
end; $agentgrid_function$;

create or replace function public.agentgrid_moderate_review(review_resource_id uuid, expected_revision integer, decision text, explanation text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare review public.agentgrid_reviews%rowtype;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 if decision is null or decision not in ('published','hidden') or explanation is null
   or char_length(btrim(explanation)) not between 20 and 2400 then raise exception 'A clear moderation decision is required' using errcode='23514'; end if;
 select * into review from public.agentgrid_reviews where id=review_resource_id for update;
 if not found or review.author_id=public.agentgrid_profile_id() then raise exception 'Review decision unavailable' using errcode='42501'; end if;
 if review.revision is distinct from expected_revision then raise exception 'Review changed before moderation' using errcode='40001'; end if;
 if review.author_withdrawn_at is not null then raise exception 'Author withdrew this review' using errcode='42501'; end if;
 if decision='published' and (not public.agentgrid_is_public_agent(review.agent_id)
   or not exists(select 1 from public.agentgrid_profiles where id=review.author_id and status='active')) then
   raise exception 'Review unavailable' using errcode='42501'; end if;
 update public.agentgrid_review_moderation set state=decision,reason=explanation,reviewed_by=public.agentgrid_profile_id(),reviewed_at=pg_catalog.now()
 where review_id=review.id;
 insert into public.agentgrid_moderation_actions(actor_id,action,review_id,explanation)
 values(public.agentgrid_profile_id(),case when decision='published' then 'published-review' else 'hidden-review' end,review.id,explanation);
end; $agentgrid_function$;

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
  'createdAt',r.created_at,'updatedAt',r.updated_at,'withdrawnAt',r.author_withdrawn_at,
  'state',case when r.author_withdrawn_at is not null then 'withdrawn' else m.state end,
  'reason',case when r.author_withdrawn_at is not null then '' else m.reason end,
  'reviewedAt',case when r.author_withdrawn_at is not null then null else m.reviewed_at end
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

-- Public availability and write eligibility are live; private/unknown targets are indistinguishable.
create function public.agentgrid_review_context(resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id(); current_version jsonb; can_review boolean:=false;
begin
 if not public.agentgrid_is_member() then raise exception 'Membership required' using errcode='42501'; end if;
 if resource_id is null then raise exception 'Resource required' using errcode='23514'; end if;
 if public.agentgrid_is_public_agent(resource_id) then
  select pg_catalog.jsonb_build_object('id',v.id,'version',v.version),a.owner_id<>actor into current_version,can_review
  from public.agentgrid_agents a join public.agentgrid_releases r on r.agent_id=a.id
  join public.agentgrid_agent_versions v on v.id=r.version_id and v.agent_id=a.id
  where a.id=resource_id and public.agentgrid_is_public_version(v.id);
 end if;
 return pg_catalog.jsonb_build_object('resourceId',resource_id,'review',public.agentgrid_owned_review(resource_id),
  'available',current_version is not null,'canReview',coalesce(can_review,false) and current_version is not null,'currentVersion',current_version);
end; $agentgrid_function$;
revoke all on function public.agentgrid_review_context(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_review_context(uuid) to authenticated;
