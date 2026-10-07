-- AgentGrid-owned resources only. Run inside the guarded migration transaction.
-- Supabase-managed auth.users/auth.uid() must already exist; never replace them.
do $agentgrid_environment$
begin
  if pg_catalog.current_setting('server_encoding') <> 'UTF8' then
    raise exception 'AgentGrid requires a UTF8 database';
  end if;
  if pg_catalog.to_regclass('auth.users') is null then
    raise exception 'Managed identity infrastructure is missing';
  end if;
end
$agentgrid_environment$;

create table public.agentgrid_schema_migrations (
  version text primary key check (version ~ '^[0-9]{3}_[a-z0-9_]+$'),
  checksum text not null check (checksum ~ '^[a-f0-9]{64}$'),
  applied_at timestamptz not null default pg_catalog.now()
);

create table public.agentgrid_configuration (
  singleton boolean primary key default true check (singleton),
  community_terms_version text,
  privacy_notice_version text,
  profile_creation_enabled boolean not null default false,
  submission_enabled boolean not null default false,
  check (not profile_creation_enabled or (
    community_terms_version is not null and privacy_notice_version is not null
  ))
);
insert into public.agentgrid_configuration (singleton) values (true);

create table public.agentgrid_profiles (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  username text not null unique check (
    username ~ '^[a-z][a-z0-9_]{2,29}$' and username not in
    ('admin','administrator','agentgrid','api','auth','help','moderator','new','settings','support','system')
  ),
  display_name text not null check (pg_catalog.char_length(pg_catalog.btrim(display_name)) between 2 and 80),
  bio text not null default '' check (pg_catalog.char_length(bio) <= 1600),
  website_url text check (website_url is null or (
    website_url ~ '^https://[^/@[:space:]]+([/?#][^[:space:]]*)?$' and pg_catalog.char_length(website_url) <= 2048
  )),
  visibility text not null default 'private' check (visibility in ('private','public')),
  status text not null default 'active' check (status in ('active','suspended','deactivated')),
  terms_version text not null check (pg_catalog.char_length(terms_version) between 1 and 40),
  privacy_version text not null check (pg_catalog.char_length(privacy_version) between 1 and 40),
  terms_accepted_at timestamptz not null default pg_catalog.now(),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now()
);

-- Keep business/creator IDs stable across extraction and shared-auth deletion.
-- This private link is the only identity FK; it never stores email/provider metadata.
create table public.agentgrid_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_id uuid not null unique references public.agentgrid_profiles(id) on delete cascade,
  created_at timestamptz not null default pg_catalog.now()
);

create table public.agentgrid_user_roles (
  user_id uuid not null references public.agentgrid_profiles(id) on delete cascade,
  role text not null check (role in ('moderator','administrator')),
  granted_by uuid references public.agentgrid_profiles(id) on delete set null,
  granted_at timestamptz not null default pg_catalog.now(),
  primary key (user_id, role)
);

create table public.agentgrid_rate_limits (
  user_id uuid not null references public.agentgrid_profiles(id) on delete cascade,
  action text not null check (action in ('create_agent','save_draft','submit','review','report','favorite','fork')),
  window_started_at timestamptz not null,
  count integer not null check (count > 0),
  primary key (user_id, action)
);

create function public.agentgrid_profile_id()
returns uuid
language sql stable security definer
set search_path = ''
as $agentgrid_function$
  select profile_id from public.agentgrid_identities
  where user_id = (select auth.uid());
$agentgrid_function$;

create function public.agentgrid_is_member()
returns boolean
language sql stable security definer
set search_path = ''
as $agentgrid_function$
  select exists (
    select 1 from public.agentgrid_profiles p
    where p.id = public.agentgrid_profile_id() and p.status = 'active'
  );
$agentgrid_function$;

create function public.agentgrid_has_role(required_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $agentgrid_function$
  select exists (
    select 1 from public.agentgrid_user_roles r
    join public.agentgrid_profiles p on p.id = r.user_id
    where r.user_id = public.agentgrid_profile_id() and p.status = 'active'
      and r.role = any(required_roles)
  );
$agentgrid_function$;

-- Internal quota helper: callers cannot choose their own limits or identity.
-- One row per user/action; resetting a window does not create growing event logs.
create function public.agentgrid_enforce_quota(action_name text, maximum integer, window_seconds integer)
returns void
language plpgsql security definer
set search_path = ''
as $agentgrid_function$
declare
  actor uuid := public.agentgrid_profile_id();
  used integer;
  boundary timestamptz := pg_catalog.clock_timestamp();
begin
  if not public.agentgrid_is_member() or maximum not between 1 and 10000 or window_seconds not between 1 and 86400 then
    raise exception 'AgentGrid action is unavailable' using errcode = '42501';
  end if;
  insert into public.agentgrid_rate_limits as limits (user_id, action, window_started_at, count)
  values (actor, action_name, boundary, 1)
  on conflict (user_id, action) do update set
    count = case when limits.window_started_at <= boundary - pg_catalog.make_interval(secs => window_seconds)
      then 1 else limits.count + 1 end,
    window_started_at = case when limits.window_started_at <= boundary - pg_catalog.make_interval(secs => window_seconds)
      then boundary else limits.window_started_at end
  returning count into used;
  if used > maximum then
    raise exception 'AgentGrid action limit reached' using errcode = 'P0001';
  end if;
end
$agentgrid_function$;

-- Explicit AgentGrid entry only. There is no auth.users trigger and no metadata-derived role.
create function public.agentgrid_create_profile(
  requested_username text, requested_display_name text,
  accepted_terms_version text, acknowledged_privacy_version text
)
returns uuid
language plpgsql security definer
set search_path = ''
as $agentgrid_function$
declare
  actor uuid := auth.uid();
  profile uuid;
  configuration public.agentgrid_configuration%rowtype;
begin
  if actor is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if requested_username ~ '^u_' then
    raise exception 'Username prefix is reserved' using errcode = '23514';
  end if;
  select * into configuration from public.agentgrid_configuration where singleton;
  if not configuration.profile_creation_enabled
    or accepted_terms_version is distinct from configuration.community_terms_version
    or acknowledged_privacy_version is distinct from configuration.privacy_notice_version then
    raise exception 'Current AgentGrid terms are required' using errcode = '42501';
  end if;
  if exists (select 1 from public.agentgrid_identities where user_id = actor) then
    raise exception 'AgentGrid profile already exists' using errcode = '23505';
  end if;
  insert into public.agentgrid_profiles (username, display_name, terms_version, privacy_version)
  values (requested_username, requested_display_name, accepted_terms_version, acknowledged_privacy_version)
  returning id into profile;
  insert into public.agentgrid_identities (user_id, profile_id) values (actor, profile);
  return profile;
end
$agentgrid_function$;

create function public.agentgrid_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $agentgrid_function$
begin
  new.updated_at := pg_catalog.now();
  return new;
end
$agentgrid_function$;

create trigger agentgrid_profiles_touch_updated_at
before update on public.agentgrid_profiles
for each row execute function public.agentgrid_touch_updated_at();

-- Bijective full-UUID base36 encoding avoids truncation collisions and personal names.
create function public.agentgrid_anonymous_username(profile uuid)
returns text
language plpgsql immutable
set search_path = ''
as $agentgrid_function$
declare
  bytes bytea := pg_catalog.decode(pg_catalog.replace(profile::text,'-',''),'hex');
  number numeric := 0;
  encoded text := '';
  alphabet text := '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  for index in 0..15 loop number := number * 256 + pg_catalog.get_byte(bytes,index); end loop;
  while number > 0 loop
    encoded := pg_catalog.substr(alphabet,pg_catalog.mod(number,36)::integer+1,1) || encoded;
    number := pg_catalog.trunc(number/36);
  end loop;
  return 'u_' || pg_catalog.lpad(encoded,26,'0');
end
$agentgrid_function$;

create function public.agentgrid_detach_identity()
returns trigger
language plpgsql security definer
set search_path = ''
as $agentgrid_function$
begin
  update public.agentgrid_profiles set
    status = 'deactivated', visibility = 'private', display_name = 'Deleted creator',
    username = public.agentgrid_anonymous_username(id),
    bio = '', website_url = null
  where id = old.profile_id;
  return old;
end
$agentgrid_function$;

-- This trigger belongs to AgentGrid. No trigger is added to auth.users.
create trigger agentgrid_identities_detach
after delete on public.agentgrid_identities
for each row execute function public.agentgrid_detach_identity();

alter table public.agentgrid_schema_migrations enable row level security;
alter table public.agentgrid_configuration enable row level security;
alter table public.agentgrid_profiles enable row level security;
alter table public.agentgrid_identities enable row level security;
alter table public.agentgrid_user_roles enable row level security;
alter table public.agentgrid_rate_limits enable row level security;

-- Explicit grants override any existing project default grants, without changing those defaults.
revoke all on table public.agentgrid_schema_migrations, public.agentgrid_configuration,
  public.agentgrid_profiles, public.agentgrid_identities, public.agentgrid_user_roles, public.agentgrid_rate_limits
from public, anon, authenticated, service_role;

grant select on public.agentgrid_profiles, public.agentgrid_user_roles to authenticated;
grant update (display_name, bio, website_url) on public.agentgrid_profiles to authenticated;

create policy agentgrid_profiles_read_self on public.agentgrid_profiles
for select to authenticated using (id = public.agentgrid_profile_id());
create policy agentgrid_profiles_read_moderation on public.agentgrid_profiles
for select to authenticated using (public.agentgrid_has_role(array['moderator','administrator']));
create policy agentgrid_profiles_update_self on public.agentgrid_profiles
for update to authenticated
using (id = public.agentgrid_profile_id() and public.agentgrid_is_member())
with check (id = public.agentgrid_profile_id() and status = 'active');
create policy agentgrid_user_roles_read_self on public.agentgrid_user_roles
for select to authenticated using (user_id = public.agentgrid_profile_id());
create policy agentgrid_user_roles_read_administration on public.agentgrid_user_roles
for select to authenticated using (public.agentgrid_has_role(array['administrator']));

revoke all on function public.agentgrid_profile_id(), public.agentgrid_is_member(), public.agentgrid_has_role(text[]),
  public.agentgrid_enforce_quota(text, integer, integer),
  public.agentgrid_create_profile(text, text, text, text), public.agentgrid_touch_updated_at(),
  public.agentgrid_anonymous_username(uuid), public.agentgrid_detach_identity()
from public, anon, authenticated, service_role;
grant execute on function public.agentgrid_profile_id(), public.agentgrid_is_member(), public.agentgrid_has_role(text[]),
  public.agentgrid_create_profile(text, text, text, text) to authenticated;
