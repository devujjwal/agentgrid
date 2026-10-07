-- Private workspace data and public release data have separate access boundaries.
create table public.agentgrid_categories (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 3 and 80),
  description text not null check (char_length(description) between 40 and 800),
  position integer not null unique check (position between 1 and 100)
);
insert into public.agentgrid_categories (slug,name,description,position) values
 ('marketing','Marketing','Audience insight, campaign planning and responsible growth workflows.',1),
 ('productivity','Productivity','Organize information, plan work and reduce repetitive personal tasks.',2),
 ('research','Research','Evaluate sources, compare evidence and synthesize research with clear uncertainty.',3),
 ('education','Education','Learn, practise and teach with explanations and appropriate learning boundaries.',4),
 ('content','Content','Plan, draft and improve useful content while preserving voice and accuracy.',5),
 ('ecommerce','Ecommerce','Improve product information, merchandising and customer operations.',6),
 ('business-operations','Business operations','Support decisions, document processes and improve everyday business operations.',7),
 ('everyday','Everyday life','Practical planning and organization for useful everyday workflows.',8),
 ('seo','SEO','Analyze search performance and improve discoverability using verifiable evidence.',9),
 ('development','Development','Understand, review and improve software with explicit safety and validation.',10);

create table public.agentgrid_platforms (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique check (char_length(name) between 2 and 80),
  website_url text not null check (website_url ~ '^https://[^/@[:space:]]+(/[^[:space:]]*)?$')
);
-- Platform vocabulary is not a claim that any particular package is tested there.
insert into public.agentgrid_platforms (slug,name,website_url) values
 ('chatgpt','ChatGPT','https://chatgpt.com/'),('claude','Claude','https://claude.ai/'),
 ('gemini','Gemini','https://gemini.google.com/'),('codex','Codex','https://openai.com/codex/'),
 ('cursor','Cursor','https://cursor.com/'),('n8n','n8n','https://n8n.io/');

create table public.agentgrid_agents (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  slug text not null unique check (
    slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80
    and slug not in ('categories','new','search','submit')
  ),
  owner_id uuid not null references public.agentgrid_profiles(id) on delete restrict,
  forked_from_version_id uuid,
  status text not null default 'active' check (status in ('active','blocked','archived')),
  created_at timestamptz not null default pg_catalog.now()
);
create index agentgrid_agents_owner on public.agentgrid_agents(owner_id,created_at desc);

create table public.agentgrid_drafts (
  agent_id uuid primary key references public.agentgrid_agents(id) on delete restrict,
  specification jsonb not null check (pg_catalog.octet_length(specification::text) <= 120000),
  editorial jsonb not null default '{}' check (pg_catalog.jsonb_typeof(editorial)='object' and pg_catalog.octet_length(editorial::text)<=32000),
  revision integer not null default 1 check (revision > 0),
  updated_at timestamptz not null default pg_catalog.now()
);

create table public.agentgrid_agent_versions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  agent_id uuid not null references public.agentgrid_agents(id) on delete restrict,
  version text not null check (version ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' and char_length(version)<=24),
  specification jsonb not null check (pg_catalog.octet_length(specification::text) <= 120000),
  editorial jsonb not null default '{}' check (pg_catalog.jsonb_typeof(editorial)='object' and pg_catalog.octet_length(editorial::text)<=32000),
  -- This identifies the immutable spec+editorial database bundle, not file bytes.
  content_digest text not null check (content_digest ~ '^[a-f0-9]{64}$'),
  category_slug text not null references public.agentgrid_categories(slug) on delete restrict,
  submitted_by uuid not null references public.agentgrid_profiles(id) on delete restrict,
  created_at timestamptz not null default pg_catalog.now(),
  unique (agent_id,version),
  unique (agent_id,id)
);
alter table public.agentgrid_agents add constraint agentgrid_agents_fork_source
foreign key (forked_from_version_id) references public.agentgrid_agent_versions(id) on delete restrict;
create index agentgrid_agents_fork_source_index on public.agentgrid_agents(forked_from_version_id)
where forked_from_version_id is not null;
create index agentgrid_agent_versions_category on public.agentgrid_agent_versions(category_slug);

-- convert_to is STABLE in PostgreSQL, so compute once on immutable insertion
-- instead of incorrectly declaring an immutable generated-column expression.
create function public.agentgrid_set_version_digest()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$ begin
 new.content_digest := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   pg_catalog.jsonb_build_object('specification',new.specification,'editorial',new.editorial)::text,'UTF8')),'hex');
 return new;
end; $agentgrid_function$;
create trigger agentgrid_agent_versions_digest before insert on public.agentgrid_agent_versions
for each row execute function public.agentgrid_set_version_digest();

create table public.agentgrid_version_platforms (
  version_id uuid not null references public.agentgrid_agent_versions(id) on delete restrict,
  platform_slug text not null references public.agentgrid_platforms(slug) on delete restrict,
  primary key(version_id,platform_slug)
);
create index agentgrid_version_platforms_discovery on public.agentgrid_version_platforms(platform_slug,version_id);

create table public.agentgrid_submissions (
  version_id uuid primary key references public.agentgrid_agent_versions(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','approved','rejected','withdrawn')),
  reason text not null default '' check (char_length(reason)<=2400),
  reviewed_by uuid references public.agentgrid_profiles(id) on delete restrict,
  reviewed_at timestamptz,
  created_at timestamptz not null default pg_catalog.now(),
  check ((state='pending' and reviewed_at is null and reviewed_by is null)
    or (state<>'pending' and reviewed_at is not null and reviewed_by is not null))
);
create index agentgrid_submissions_queue on public.agentgrid_submissions(created_at,version_id) where state='pending';

create table public.agentgrid_releases (
  agent_id uuid primary key references public.agentgrid_agents(id) on delete restrict,
  version_id uuid not null unique,
  released_at timestamptz not null default pg_catalog.now(),
  released_by uuid not null references public.agentgrid_profiles(id) on delete restrict,
  -- Private, validated editorial/host-test evidence; never exposed as public JSON.
  quality_manifest jsonb not null check (pg_catalog.octet_length(quality_manifest::text)<=32000),
  foreign key(agent_id,version_id) references public.agentgrid_agent_versions(agent_id,id) on delete restrict
);

create function public.agentgrid_is_public_agent(resource_id uuid)
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select exists (
   select 1 from public.agentgrid_agents a
   join public.agentgrid_profiles p on p.id=a.owner_id
   join public.agentgrid_releases r on r.agent_id=a.id
   where a.id=resource_id and a.status='active' and p.status='active'
 );
$agentgrid_function$;

-- Defense in depth for fields that affect database authorization, identity and
-- reuse. This is not the full Zod contract. All public release preparation must
-- parse the complete contract again in the trusted server/publisher boundary.
create function public.agentgrid_check_resource(spec jsonb, expected_slug text)
returns void language plpgsql set search_path=''
as $agentgrid_function$
declare permission jsonb; license text; grants jsonb;
begin
 if pg_catalog.jsonb_typeof(spec) is distinct from 'object'
   or pg_catalog.octet_length(spec::text)>120000
   or spec->>'schema_version' is distinct from '0.1'
   or spec#>>'{identity,slug}' is distinct from expected_slug
   or not coalesce(spec->>'version' ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$',false)
   or char_length(spec->>'version')>24
   or not exists (select 1 from public.agentgrid_categories where slug=spec->>'category')
   or pg_catalog.jsonb_typeof(spec->'platforms') is distinct from 'array'
   or pg_catalog.jsonb_array_length(spec->'platforms') not between 1 and 10
   or pg_catalog.jsonb_typeof(spec->'permissions') is distinct from 'array'
   or pg_catalog.jsonb_array_length(spec->'permissions')>16 then
   raise exception 'Invalid resource envelope' using errcode='23514';
 end if;
 if exists (select 1 from pg_catalog.jsonb_object_keys(spec) as key
   where key not in ('schema_version','identity','version','category','purpose','capabilities','execution',
   'inputs','outputs','requirements','platforms','tools','permissions','safety','examples','pricing','license','extensions')) then
   raise exception 'Unknown resource field' using errcode='23514';
 end if;
 if exists (select 1 from pg_catalog.jsonb_array_elements(spec->'platforms') item
   where not exists (select 1 from public.agentgrid_platforms p where p.slug=item->>'slug'))
   or (select count(*)<>count(distinct item->>'slug') from pg_catalog.jsonb_array_elements(spec->'platforms') item) then
   raise exception 'Unknown or duplicate platform' using errcode='23514';
 end if;
 license := spec#>>'{license,identifier}'; grants := spec#>'{license,permissions}';
 if license is null or license not in ('unselected','CC-BY-4.0','CC0-1.0','MIT','custom','all-rights-reserved')
   or pg_catalog.jsonb_typeof(grants) is distinct from 'object'
   or pg_catalog.jsonb_typeof(grants->'use') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'modify') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'redistribute') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'public_fork') is distinct from 'boolean'
   or (license='unselected' and grants <> '{"use":false,"modify":false,"redistribute":false,"public_fork":false}'::jsonb)
   or (license in ('CC-BY-4.0','CC0-1.0','MIT') and grants <> '{"use":true,"modify":true,"redistribute":true,"public_fork":true}'::jsonb)
   or (license='all-rights-reserved' and (grants->>'redistribute'='true' or grants->>'public_fork'='true'))
   or (grants->>'public_fork'='true' and not (grants->>'use'='true' and grants->>'modify'='true' and grants->>'redistribute'='true')) then
   raise exception 'Inconsistent reuse permissions' using errcode='23514';
 end if;
 for permission in select * from pg_catalog.jsonb_array_elements(spec->'permissions') loop
   if permission->>'operation' is null or permission->>'operation' not in ('read','write','network')
     or pg_catalog.jsonb_typeof(permission->'confirmation_required') is distinct from 'boolean'
     or (permission->>'operation'='write' and permission->>'confirmation_required'<>'true') then
     raise exception 'Invalid permission boundary' using errcode='23514';
   end if;
 end loop;
end;
$agentgrid_function$;

create function public.agentgrid_deny_immutable_mutation()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$ begin
 raise exception 'Submitted resource content and lineage are immutable' using errcode='55000';
end; $agentgrid_function$;
create trigger agentgrid_agent_versions_immutable before update or delete on public.agentgrid_agent_versions
for each row execute function public.agentgrid_deny_immutable_mutation();
create trigger agentgrid_version_platforms_immutable before update or delete on public.agentgrid_version_platforms
for each row execute function public.agentgrid_deny_immutable_mutation();

create function public.agentgrid_create_agent(requested_slug text, initial_specification jsonb, source_version_id uuid default null, initial_editorial jsonb default '{}')
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource_id uuid; source public.agentgrid_agent_versions%rowtype;
begin
 perform public.agentgrid_enforce_quota('create_agent',10,86400);
 perform public.agentgrid_check_resource(initial_specification,requested_slug);
 if source_version_id is not null then
   perform public.agentgrid_enforce_quota('fork',10,86400);
   select * into source from public.agentgrid_agent_versions where id=source_version_id;
   if not found or not public.agentgrid_is_public_agent(source.agent_id)
     or not exists(select 1 from public.agentgrid_submissions where version_id=source.id and state='approved')
     or source.specification#>>'{license,permissions,public_fork}' is distinct from 'true' then
     raise exception 'Source version does not permit public forks' using errcode='42501';
   end if;
   -- Keep the source grant as the initial fork license. Relicensing cannot erase
   -- a source attribution/share condition; custom-license forks need review.
   if initial_specification->'license' is distinct from source.specification->'license' then
     raise exception 'Fork must retain source license' using errcode='23514';
   end if;
 end if;
 insert into public.agentgrid_agents(slug,owner_id,forked_from_version_id)
 values(requested_slug,public.agentgrid_profile_id(),source_version_id) returning id into resource_id;
 insert into public.agentgrid_drafts(agent_id,specification,editorial) values(resource_id,initial_specification,initial_editorial);
 return resource_id;
end; $agentgrid_function$;

create function public.agentgrid_save_draft(resource_id uuid, expected_revision integer, updated_specification jsonb, updated_editorial jsonb default null)
returns integer language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource public.agentgrid_agents%rowtype; next_revision integer; source_license jsonb;
begin
 perform public.agentgrid_enforce_quota('save_draft',120,3600);
 select * into resource from public.agentgrid_agents where id=resource_id for update;
 if not found or resource.owner_id<>public.agentgrid_profile_id() or resource.status<>'active' then
   raise exception 'Draft unavailable' using errcode='42501';
 end if;
 perform public.agentgrid_check_resource(updated_specification,resource.slug);
 if resource.forked_from_version_id is not null then
   select specification->'license' into source_license from public.agentgrid_agent_versions where id=resource.forked_from_version_id;
   if updated_specification->'license' is distinct from source_license then
     raise exception 'Fork must retain source license' using errcode='23514';
   end if;
 end if;
 update public.agentgrid_drafts set specification=updated_specification,
 editorial=case when updated_editorial is null then editorial else updated_editorial end,revision=revision+1,updated_at=pg_catalog.now()
 where agent_id=resource_id and revision=expected_revision returning revision into next_revision;
 if next_revision is null then raise exception 'Draft changed; reload before saving' using errcode='40001'; end if;
 return next_revision;
end; $agentgrid_function$;

create function public.agentgrid_submit_version(resource_id uuid, expected_revision integer)
returns uuid language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource public.agentgrid_agents%rowtype; draft public.agentgrid_drafts%rowtype; version_id uuid;
begin
 perform public.agentgrid_enforce_quota('submit',10,86400);
 if not exists(select 1 from public.agentgrid_configuration where singleton and submission_enabled) then
   raise exception 'Submissions unavailable' using errcode='42501';
 end if;
 select * into resource from public.agentgrid_agents where id=resource_id for update;
 if not found or resource.owner_id<>public.agentgrid_profile_id() or resource.status<>'active' then
   raise exception 'Resource unavailable' using errcode='42501';
 end if;
 select * into draft from public.agentgrid_drafts where agent_id=resource_id;
 if draft.revision is distinct from expected_revision then
   raise exception 'Draft changed; reload before submitting' using errcode='40001';
 end if;
 perform public.agentgrid_check_resource(draft.specification,resource.slug);
 if draft.specification#>>'{license,identifier}'='unselected'
   or draft.specification#>>'{license,permissions,use}'<>'true' then
   raise exception 'An explicit use license is required' using errcode='23514';
 end if;
 if exists(select 1 from public.agentgrid_submissions s join public.agentgrid_agent_versions v on v.id=s.version_id
   where v.agent_id=resource_id and s.state='pending') then
   raise exception 'A version is already awaiting review' using errcode='23505';
 end if;
 if exists(select 1 from public.agentgrid_agent_versions where agent_id=resource_id and version=draft.specification->>'version') then
   raise exception 'Submitted versions cannot be reused' using errcode='23505'; end if;
 if exists(select 1 from public.agentgrid_agent_versions where agent_id=resource_id
   and pg_catalog.string_to_array(version,'.')::numeric[] >= pg_catalog.string_to_array(draft.specification->>'version','.')::numeric[]) then
   raise exception 'A new submission must advance the package version' using errcode='23514'; end if;
 insert into public.agentgrid_agent_versions(agent_id,version,specification,editorial,category_slug,submitted_by)
 values(resource_id,draft.specification->>'version',draft.specification,draft.editorial,draft.specification->>'category',resource.owner_id)
 returning id into version_id;
 insert into public.agentgrid_version_platforms(version_id,platform_slug)
 select version_id,item->>'slug' from pg_catalog.jsonb_array_elements(draft.specification->'platforms') item;
 insert into public.agentgrid_submissions(version_id) values(version_id);
 return version_id;
end; $agentgrid_function$;

create function public.agentgrid_decide_submission(submitted_version_id uuid, decision text, explanation text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare owner uuid; current_state text;
begin
 select a.owner_id,s.state into owner,current_state from public.agentgrid_submissions s
 join public.agentgrid_agent_versions v on v.id=s.version_id join public.agentgrid_agents a on a.id=v.agent_id
 where s.version_id=submitted_version_id for update of s;
 if not found or current_state<>'pending' or not public.agentgrid_is_member()
   or not ((decision='withdrawn' and owner=public.agentgrid_profile_id())
     or (decision='rejected' and public.agentgrid_has_role(array['moderator','administrator']))) then
   raise exception 'Submission decision unavailable' using errcode='42501';
 end if;
 if explanation is null or char_length(btrim(explanation)) not between 20 and 2400 then
   raise exception 'A clear decision reason is required' using errcode='23514';
 end if;
 update public.agentgrid_submissions set state=decision,reason=explanation,
 reviewed_by=public.agentgrid_profile_id(),reviewed_at=pg_catalog.now() where version_id=submitted_version_id;
end; $agentgrid_function$;

-- Server-only publication authority. The endpoint verifies the moderator's real
-- token, fully parses the immutable spec and validates actual editorial/test
-- evidence before calling this RPC. Browser/admin JWTs cannot call it directly.
-- No server key is provisioned/deployed by this migration.
create function public.agentgrid_publish_version(submitted_version_id uuid, moderator_profile_id uuid, validated_digest text, evidence jsonb)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare submitted public.agentgrid_agent_versions%rowtype; current_state text;
begin
 if not exists(select 1 from public.agentgrid_user_roles r join public.agentgrid_profiles p on p.id=r.user_id
   where p.id=moderator_profile_id and p.status='active' and r.role in ('moderator','administrator')) then
   raise exception 'Verified moderator required' using errcode='42501';
 end if;
 select * into submitted from public.agentgrid_agent_versions where id=submitted_version_id;
 if not found then raise exception 'Version unavailable' using errcode='42501'; end if;
 perform 1 from public.agentgrid_agents where id=submitted.agent_id and status='active' for update;
 if not found or not exists(select 1 from public.agentgrid_profiles where id=submitted.submitted_by and status='active') then
   raise exception 'Resource unavailable' using errcode='42501';
 end if;
 select state into current_state from public.agentgrid_submissions where version_id=submitted.id for update;
 if current_state is distinct from 'pending' then raise exception 'Review is no longer pending' using errcode='40001'; end if;
 perform public.agentgrid_check_resource(submitted.specification,(select slug from public.agentgrid_agents where id=submitted.agent_id));
 if validated_digest is distinct from submitted.content_digest
   or submitted.specification#>>'{license,identifier}'='unselected'
   or submitted.specification#>>'{license,permissions,use}' is distinct from 'true'
   or pg_catalog.jsonb_typeof(evidence) is distinct from 'object'
   or pg_catalog.octet_length(evidence::text)>32000
   or evidence->>'contract_version' is distinct from '0.1'
   or evidence->>'content_digest' is distinct from submitted.content_digest
   or evidence->'editorial_passed' is distinct from 'true'::jsonb
   or evidence->'host_checks_passed' is distinct from 'true'::jsonb
   or evidence->'security_review_passed' is distinct from 'true'::jsonb then
   raise exception 'Prepared publication evidence required' using errcode='23514';
 end if;
 update public.agentgrid_submissions set state='approved',reviewed_by=moderator_profile_id,
 reviewed_at=pg_catalog.now(),reason='' where version_id=submitted.id;
 insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest)
 values(submitted.agent_id,submitted.id,moderator_profile_id,evidence)
 on conflict(agent_id) do update set version_id=excluded.version_id,released_by=excluded.released_by,
 released_at=pg_catalog.now(),quality_manifest=excluded.quality_manifest;
end; $agentgrid_function$;

alter table public.agentgrid_categories enable row level security;
alter table public.agentgrid_platforms enable row level security;
alter table public.agentgrid_agents enable row level security;
alter table public.agentgrid_drafts enable row level security;
alter table public.agentgrid_agent_versions enable row level security;
alter table public.agentgrid_version_platforms enable row level security;
alter table public.agentgrid_submissions enable row level security;
alter table public.agentgrid_releases enable row level security;
revoke all on public.agentgrid_categories,public.agentgrid_platforms,public.agentgrid_agents,
 public.agentgrid_drafts,public.agentgrid_agent_versions,public.agentgrid_version_platforms,
 public.agentgrid_submissions,public.agentgrid_releases from public,anon,authenticated,service_role;
grant select on public.agentgrid_categories,public.agentgrid_platforms,public.agentgrid_agents,
 public.agentgrid_agent_versions,public.agentgrid_version_platforms to anon,authenticated;
grant select on public.agentgrid_drafts,public.agentgrid_submissions to authenticated;
create policy agentgrid_categories_public on public.agentgrid_categories for select to anon,authenticated using(true);
create policy agentgrid_platforms_public on public.agentgrid_platforms for select to anon,authenticated using(true);
create policy agentgrid_agents_public on public.agentgrid_agents for select to anon,authenticated using(public.agentgrid_is_public_agent(id));
create policy agentgrid_agents_owner on public.agentgrid_agents for select to authenticated using(owner_id=public.agentgrid_profile_id());
create policy agentgrid_agents_staff on public.agentgrid_agents for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_drafts_owner on public.agentgrid_drafts for select to authenticated using(
 exists(select 1 from public.agentgrid_agents where id=agent_id and owner_id=public.agentgrid_profile_id()));
-- The helper below avoids exposing the private submission ledger to anonymous
-- users just to evaluate a version policy.
create function public.agentgrid_is_public_version(resource_version_id uuid)
returns boolean language sql stable security definer set search_path=''
as $agentgrid_function$
 select exists(select 1 from public.agentgrid_agent_versions v join public.agentgrid_submissions s on s.version_id=v.id
 where v.id=resource_version_id and s.state='approved' and public.agentgrid_is_public_agent(v.agent_id));
$agentgrid_function$;
create policy agentgrid_versions_public on public.agentgrid_agent_versions for select to anon,authenticated using(public.agentgrid_is_public_version(id));
create policy agentgrid_versions_owner on public.agentgrid_agent_versions for select to authenticated using(submitted_by=public.agentgrid_profile_id());
create policy agentgrid_versions_staff on public.agentgrid_agent_versions for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_version_platforms_read on public.agentgrid_version_platforms for select to anon,authenticated using(
 exists(select 1 from public.agentgrid_agent_versions where id=version_id));
create policy agentgrid_submissions_owner on public.agentgrid_submissions for select to authenticated using(
 exists(select 1 from public.agentgrid_agent_versions where id=version_id and submitted_by=public.agentgrid_profile_id()));
create policy agentgrid_submissions_staff on public.agentgrid_submissions for select to authenticated using(public.agentgrid_has_role(array['moderator','administrator']));

revoke all on function public.agentgrid_is_public_agent(uuid),public.agentgrid_is_public_version(uuid),
 public.agentgrid_check_resource(jsonb,text),public.agentgrid_deny_immutable_mutation(),
 public.agentgrid_set_version_digest(),
 public.agentgrid_create_agent(text,jsonb,uuid,jsonb),public.agentgrid_save_draft(uuid,integer,jsonb,jsonb),
 public.agentgrid_submit_version(uuid,integer),public.agentgrid_decide_submission(uuid,text,text),
 public.agentgrid_publish_version(uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_is_public_agent(uuid),public.agentgrid_is_public_version(uuid) to anon,authenticated;
grant execute on function public.agentgrid_create_agent(text,jsonb,uuid,jsonb),public.agentgrid_save_draft(uuid,integer,jsonb,jsonb),
 public.agentgrid_submit_version(uuid,integer),public.agentgrid_decide_submission(uuid,text,text) to authenticated;
grant execute on function public.agentgrid_publish_version(uuid,uuid,text,jsonb) to service_role;
