-- Live community state is deliberately independent of static SEO publication.
create table public.agentgrid_favorites (
  profile_id uuid not null references public.agentgrid_profiles(id) on delete cascade,
  agent_id uuid not null references public.agentgrid_agents(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  primary key(profile_id,agent_id)
);
create index agentgrid_favorites_resource on public.agentgrid_favorites(agent_id);
create table public.agentgrid_reviews (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  agent_id uuid not null references public.agentgrid_agents(id) on delete restrict,
  author_id uuid not null references public.agentgrid_profiles(id) on delete restrict,
  used_version_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  title text not null check (char_length(btrim(title)) between 10 and 140),
  body text not null check (char_length(btrim(body)) between 80 and 4000),
  experience_note text not null check (char_length(btrim(experience_note)) between 40 and 1000),
  revision integer not null default 1 check (revision>0),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  foreign key(agent_id,used_version_id) references public.agentgrid_agent_versions(agent_id,id) on delete restrict,
  unique(agent_id,author_id)
);
create index agentgrid_reviews_resource on public.agentgrid_reviews(agent_id,created_at desc);
create table public.agentgrid_review_moderation (
  review_id uuid primary key references public.agentgrid_reviews(id) on delete restrict,
  state text not null default 'pending' check(state in ('pending','published','hidden')),
  reason text not null default '' check(char_length(reason)<=2400),
  reviewed_by uuid references public.agentgrid_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  check((state='pending' and reviewed_by is null and reviewed_at is null)
    or (state<>'pending' and reviewed_by is not null and reviewed_at is not null))
);
create index agentgrid_review_moderation_queue on public.agentgrid_review_moderation(review_id) where state='pending';

create table public.agentgrid_reports (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  reporter_id uuid not null references public.agentgrid_profiles(id) on delete restrict,
  agent_id uuid references public.agentgrid_agents(id) on delete restrict,
  review_id uuid references public.agentgrid_reviews(id) on delete restrict,
  profile_id uuid references public.agentgrid_profiles(id) on delete restrict,
  category text not null check(category in ('spam','unsafe-instructions','privacy','copyright','broken-package','other')),
  explanation text not null check(char_length(btrim(explanation)) between 40 and 2400),
  state text not null default 'open' check(state in ('open','resolved','dismissed')),
  resolution text not null default '' check(char_length(resolution)<=2400),
  resolved_by uuid references public.agentgrid_profiles(id) on delete restrict,
  resolved_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check(pg_catalog.num_nonnulls(agent_id,review_id,profile_id)=1),
  check((state='open' and resolved_by is null and resolved_at is null)
    or (state<>'open' and resolved_by is not null and resolved_at is not null))
);
create unique index agentgrid_reports_agent_open on public.agentgrid_reports(reporter_id,agent_id,category) where state='open' and agent_id is not null;
create unique index agentgrid_reports_review_open on public.agentgrid_reports(reporter_id,review_id,category) where state='open' and review_id is not null;
create unique index agentgrid_reports_profile_open on public.agentgrid_reports(reporter_id,profile_id,category) where state='open' and profile_id is not null;
create index agentgrid_reports_queue on public.agentgrid_reports(created_at,id) where state='open';
create table public.agentgrid_moderation_actions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  actor_id uuid not null references public.agentgrid_profiles(id) on delete restrict,
  action text not null check(action in ('approved-version','rejected-version','withdrawn-version',
    'published-review','hidden-review','blocked-agent','restored-agent','suspended-profile',
    'restored-profile','resolved-report','dismissed-report','granted-role','revoked-role','deactivated-account')),
  agent_id uuid references public.agentgrid_agents(id) on delete restrict,
  version_id uuid references public.agentgrid_agent_versions(id) on delete restrict,
  review_id uuid references public.agentgrid_reviews(id) on delete restrict,
  profile_id uuid references public.agentgrid_profiles(id) on delete restrict,
  report_id uuid references public.agentgrid_reports(id) on delete restrict,
  explanation text not null check(char_length(explanation) between 20 and 2400),
  created_at timestamptz not null default pg_catalog.now(),
  check(pg_catalog.num_nonnulls(agent_id,version_id,review_id,profile_id,report_id)=1)
);
create index agentgrid_moderation_actions_recent on public.agentgrid_moderation_actions(created_at desc,id);
create trigger agentgrid_moderation_actions_immutable before update or delete on public.agentgrid_moderation_actions
for each row execute function public.agentgrid_deny_immutable_mutation();

create function public.agentgrid_is_public_review(review_resource_id uuid)
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select exists(select 1 from public.agentgrid_reviews r join public.agentgrid_review_moderation m on m.review_id=r.id
 join public.agentgrid_profiles p on p.id=r.author_id where r.id=review_resource_id and m.state='published'
 and p.status='active' and public.agentgrid_is_public_agent(r.agent_id));
$agentgrid_function$;
create function public.agentgrid_is_public_profile(creator_id uuid)
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select exists(select 1 from public.agentgrid_profiles p where p.id=creator_id and p.visibility='public' and p.status='active'
 and exists(select 1 from public.agentgrid_agents a where a.owner_id=p.id and public.agentgrid_is_public_agent(a.id)));
$agentgrid_function$;
-- A public creator projection cannot disclose private consent/auth/role fields.
create function public.agentgrid_public_creator(handle text)
returns table(id uuid,username text,display_name text,bio text,website_url text)
language sql stable security definer set search_path=''
as $agentgrid_function$
 select p.id,p.username,p.display_name,p.bio,p.website_url from public.agentgrid_profiles p
 where p.username=handle and public.agentgrid_is_public_profile(p.id);
$agentgrid_function$;
create function public.agentgrid_set_profile_visibility(make_public boolean)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_is_member() or make_public is null then raise exception 'Profile unavailable' using errcode='42501'; end if;
 update public.agentgrid_profiles set visibility=case when make_public then 'public' else 'private' end where id=public.agentgrid_profile_id();
end; $agentgrid_function$;

create function public.agentgrid_set_favorite(resource_id uuid, saved boolean)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 perform public.agentgrid_enforce_quota('favorite',120,3600);
 if saved is null then raise exception 'Save state required' using errcode='23514'; end if;
 if saved then
   if not public.agentgrid_is_public_agent(resource_id) then raise exception 'Public resource unavailable' using errcode='42501'; end if;
   insert into public.agentgrid_favorites(profile_id,agent_id) values(public.agentgrid_profile_id(),resource_id) on conflict do nothing;
 else
   -- Removal remains possible even after an agent is blocked or archived.
   delete from public.agentgrid_favorites where profile_id=public.agentgrid_profile_id() and agent_id=resource_id;
 end if;
 return saved;
end; $agentgrid_function$;

create function public.agentgrid_write_review(resource_id uuid, used_version uuid, requested_rating smallint,
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
   body=requested_body,experience_note=experience,revision=revision+1,updated_at=pg_catalog.now() where id=review_resource_id;
   update public.agentgrid_review_moderation set state='pending',reason='',reviewed_by=null,reviewed_at=null where review_id=review_resource_id;
 end if;
 return review_resource_id;
end; $agentgrid_function$;

create function public.agentgrid_moderate_review(review_resource_id uuid, expected_revision integer, decision text, explanation text)
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
 if decision='published' and (not public.agentgrid_is_public_agent(review.agent_id)
   or not exists(select 1 from public.agentgrid_profiles where id=review.author_id and status='active')) then
   raise exception 'Review unavailable' using errcode='42501'; end if;
 update public.agentgrid_review_moderation set state=decision,reason=explanation,reviewed_by=public.agentgrid_profile_id(),reviewed_at=pg_catalog.now()
 where review_id=review.id;
 insert into public.agentgrid_moderation_actions(actor_id,action,review_id,explanation)
 values(public.agentgrid_profile_id(),case when decision='published' then 'published-review' else 'hidden-review' end,review.id,explanation);
end; $agentgrid_function$;

create function public.agentgrid_create_report(target_kind text,target_id uuid,report_category text,details text)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$ declare result uuid; begin
 perform public.agentgrid_enforce_quota('report',10,86400);
 if target_kind is null or target_kind not in ('agent','review','profile')
   or (target_kind='agent' and not public.agentgrid_is_public_agent(target_id))
   or (target_kind='review' and not public.agentgrid_is_public_review(target_id))
   or (target_kind='profile' and not public.agentgrid_is_public_profile(target_id)) then
   raise exception 'Report target unavailable' using errcode='42501';
 end if;
 insert into public.agentgrid_reports(reporter_id,agent_id,review_id,profile_id,category,explanation)
 values(public.agentgrid_profile_id(),case when target_kind='agent' then target_id end,
 case when target_kind='review' then target_id end,case when target_kind='profile' then target_id end,report_category,details)
 returning id into result;
 return result;
end; $agentgrid_function$;
create function public.agentgrid_resolve_report(report_resource_id uuid,decision text,decision_reason text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 if decision is null or decision not in ('resolved','dismissed') or decision_reason is null
   or char_length(btrim(decision_reason)) not between 20 and 2400 then raise exception 'A clear resolution is required' using errcode='23514'; end if;
 update public.agentgrid_reports set state=decision,resolution=decision_reason,resolved_by=public.agentgrid_profile_id(),resolved_at=pg_catalog.now()
 where id=report_resource_id and state='open';
 if not found then raise exception 'Report already resolved or unavailable' using errcode='40001'; end if;
 insert into public.agentgrid_moderation_actions(actor_id,action,report_id,explanation)
 values(public.agentgrid_profile_id(),case when decision='resolved' then 'resolved-report' else 'dismissed-report' end,report_resource_id,decision_reason);
end; $agentgrid_function$;

create function public.agentgrid_moderate_agent(resource_id uuid,blocked boolean,explanation text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Moderator required' using errcode='42501'; end if;
 if blocked is null or explanation is null or char_length(btrim(explanation)) not between 20 and 2400 then
   raise exception 'A clear moderation decision is required' using errcode='23514'; end if;
 update public.agentgrid_agents set status=case when blocked then 'blocked' else 'active' end where id=resource_id and status<>'archived';
 if not found then raise exception 'Resource unavailable' using errcode='42501'; end if;
 insert into public.agentgrid_moderation_actions(actor_id,action,agent_id,explanation)
 values(public.agentgrid_profile_id(),case when blocked then 'blocked-agent' else 'restored-agent' end,resource_id,explanation);
end; $agentgrid_function$;

-- Version decisions made in migration 002 receive append-only audit entries.
create function public.agentgrid_log_submission_decision()
returns trigger language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if new.state is distinct from old.state then
   insert into public.agentgrid_moderation_actions(actor_id,action,version_id,explanation)
   values(new.reviewed_by,case new.state when 'approved' then 'approved-version' when 'rejected' then 'rejected-version' else 'withdrawn-version' end,
   new.version_id,case when new.state='approved' then 'Approved after server-validated publication preparation.' else new.reason end);
 end if;
 return new;
end; $agentgrid_function$;
create trigger agentgrid_submissions_decision_log after update on public.agentgrid_submissions
for each row execute function public.agentgrid_log_submission_decision();

-- Ratings summarize actual published member reviews; no seeded popularity.
create function public.agentgrid_public_rating(resource_id uuid)
returns table(review_count bigint,average_rating numeric)
language sql stable security definer set search_path=''
as $agentgrid_function$
 select count(*),round(avg(r.rating),2) from public.agentgrid_reviews r
 join public.agentgrid_review_moderation m on m.review_id=r.id
 join public.agentgrid_profiles p on p.id=r.author_id
 where r.agent_id=resource_id and m.state='published' and p.status='active'
 and (select public.agentgrid_is_public_agent(resource_id));
$agentgrid_function$;

alter table public.agentgrid_favorites enable row level security;
alter table public.agentgrid_reviews enable row level security;
alter table public.agentgrid_review_moderation enable row level security;
alter table public.agentgrid_reports enable row level security;
alter table public.agentgrid_moderation_actions enable row level security;
revoke all on public.agentgrid_favorites,public.agentgrid_reviews,public.agentgrid_review_moderation,
 public.agentgrid_reports,public.agentgrid_moderation_actions from public,anon,authenticated,service_role;
grant select on public.agentgrid_reviews to anon,authenticated;
grant select on public.agentgrid_favorites,public.agentgrid_review_moderation,public.agentgrid_reports,
 public.agentgrid_moderation_actions to authenticated;
create policy agentgrid_favorites_owner on public.agentgrid_favorites for select to authenticated using(profile_id=public.agentgrid_profile_id());
create policy agentgrid_reviews_public on public.agentgrid_reviews for select to anon,authenticated using(public.agentgrid_is_public_review(id));
create policy agentgrid_reviews_owner on public.agentgrid_reviews for select to authenticated using(author_id=public.agentgrid_profile_id());
create policy agentgrid_reviews_staff on public.agentgrid_reviews for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_review_moderation_owner on public.agentgrid_review_moderation for select to authenticated using(
 exists(select 1 from public.agentgrid_reviews r where r.id=review_id and r.author_id=public.agentgrid_profile_id()));
create policy agentgrid_review_moderation_staff on public.agentgrid_review_moderation for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_reports_owner on public.agentgrid_reports for select to authenticated using(reporter_id=public.agentgrid_profile_id());
create policy agentgrid_reports_staff on public.agentgrid_reports for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_moderation_actions_staff on public.agentgrid_moderation_actions for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
revoke all on function public.agentgrid_is_public_review(uuid),public.agentgrid_is_public_profile(uuid),
 public.agentgrid_public_creator(text),public.agentgrid_set_profile_visibility(boolean),public.agentgrid_set_favorite(uuid,boolean),
 public.agentgrid_write_review(uuid,uuid,smallint,text,text,text,integer),public.agentgrid_moderate_review(uuid,integer,text,text),
 public.agentgrid_create_report(text,uuid,text,text),public.agentgrid_resolve_report(uuid,text,text),
 public.agentgrid_moderate_agent(uuid,boolean,text),public.agentgrid_log_submission_decision(),public.agentgrid_public_rating(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_is_public_review(uuid),public.agentgrid_is_public_profile(uuid),
 public.agentgrid_public_creator(text),public.agentgrid_public_rating(uuid) to anon,authenticated;
grant execute on function public.agentgrid_set_profile_visibility(boolean),public.agentgrid_set_favorite(uuid,boolean),
 public.agentgrid_write_review(uuid,uuid,smallint,text,text,text,integer),public.agentgrid_moderate_review(uuid,integer,text,text),
 public.agentgrid_create_report(text,uuid,text,text),public.agentgrid_resolve_report(uuid,text,text),public.agentgrid_moderate_agent(uuid,boolean,text)
to authenticated;
