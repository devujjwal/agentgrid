-- Only for the fresh, network-isolated AgentGrid test container. Never run remotely.
do $$ begin
 if current_database() !~ '^agentgrid_qa(_[a-f0-9]+)?$' then raise exception 'Local fixture database required'; end if;
 if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
-- Simulate permissive project default grants: AgentGrid must explicitly revoke its own objects.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to public;
-- Protected cross-application sentinel and its independent authorization.
create table public.picmagic_private_fixture (id integer primary key, confidential text not null);
insert into public.picmagic_private_fixture values (1, 'synthetic-protected-value');
alter table public.picmagic_private_fixture enable row level security;
create table public.picmagic_admin_fixture (user_id uuid primary key);
alter table public.picmagic_admin_fixture enable row level security;
create function public.picmagic_admin_only_fixture() returns text language plpgsql security definer
set search_path = '' as $$ begin
 if not exists (select 1 from public.picmagic_admin_fixture where user_id=auth.uid()) then
  raise exception 'Not a PicMagic admin' using errcode='42501';
 end if;
 return 'synthetic-admin-result';
end $$;
