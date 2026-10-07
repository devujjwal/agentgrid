-- Synthetic fixtures only, rolled back at the end of the isolated database session.
begin;
create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'Assertion failed: %', explanation; end if;
end $$;
create function pg_temp.agentgrid_expect_error(statement text, expected text) returns void
language plpgsql as $$ begin
 begin
  execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %', sqlstate, expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised', expected;
end $$;
create function pg_temp.agentgrid_quota_probe() returns void language sql security definer
set search_path = '' as $$ select public.agentgrid_enforce_quota('create_agent',2,60) $$;

insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,6) i;
set local role anon;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_profiles','42501');
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_create_profile('anon_user','Anon user','fixture-v1','fixture-v1')$statement$,'42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'anon cannot read protected application data');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"administrator":true}}';
set local role authenticated;
select pg_temp.agentgrid_assert(not public.agentgrid_is_member(),'shared auth alone is not AgentGrid membership');
select pg_temp.agentgrid_assert(not public.agentgrid_has_role(array['administrator']),'metadata cannot appoint an administrator');
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_create_profile('fixture_owner','Fixture owner','fixture-v1','fixture-v1')$statement$,'42501');
reset role;
update public.agentgrid_configuration set community_terms_version='fixture-v1', privacy_notice_version='fixture-v1',profile_creation_enabled=true;
set local role authenticated;
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_create_profile('fixture_owner','Fixture owner','old-terms','fixture-v1')$statement$,'42501');
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_create_profile('u_reserved','Reserved','fixture-v1','fixture-v1')$statement$,'23514');
select public.agentgrid_create_profile('fixture_owner','Fixture owner','fixture-v1','fixture-v1');
select pg_temp.agentgrid_assert(public.agentgrid_is_member(),'explicit entry creates AgentGrid membership');
select pg_temp.agentgrid_assert(public.agentgrid_profile_id() <> auth.uid(),'business identity is independent of shared auth');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_identities','42501');
select pg_temp.agentgrid_assert(not public.agentgrid_has_role(array['administrator','moderator']),'ordinary profile has no privileged roles');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_profiles),'owner reads own private profile');
update public.agentgrid_profiles set bio='A synthetic profile update.' where id=public.agentgrid_profile_id();
select pg_temp.agentgrid_expect_error($statement$update public.agentgrid_profiles set status='active'$statement$,'42501');
select pg_temp.agentgrid_expect_error($statement$update public.agentgrid_profiles set username='stolen_handle'$statement$,'42501');
select pg_temp.agentgrid_expect_error($statement$insert into public.agentgrid_user_roles(user_id,role) values(public.agentgrid_profile_id(),'administrator')$statement$,'42501');
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_enforce_quota('create_agent',10000,1)$statement$,'42501');
select pg_temp.agentgrid_quota_probe();
select pg_temp.agentgrid_quota_probe();
select pg_temp.agentgrid_expect_error('select pg_temp.agentgrid_quota_probe()','P0001');
select pg_temp.agentgrid_expect_error($statement$select public.agentgrid_create_profile('fixture_replacement','Replacement','fixture-v1','fixture-v1')$statement$,'23505');
reset role;
select pg_temp.agentgrid_assert((select count=2 from public.agentgrid_rate_limits where action='create_agent'),'denied quota attempt cannot reset the counter');

insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(2,5) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(2,5) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000003','moderator'),
 ('10000000-0000-4000-8000-000000000004','administrator'),
 ('10000000-0000-4000-8000-000000000005','administrator');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000005';

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_profiles where username='fixture_owner'),'other member cannot read private owner profile');
update public.agentgrid_profiles set bio='Unauthorized modification' where username='fixture_owner';
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_user_roles),'other member cannot read staff roles');
reset role;
select pg_temp.agentgrid_assert((select bio='A synthetic profile update.' from public.agentgrid_profiles where username='fixture_owner'),'other member update had no effect');

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_has_role(array['moderator']),'moderator role is authoritative');
select pg_temp.agentgrid_assert(not public.agentgrid_has_role(array['administrator']),'moderator cannot assume admin');
select pg_temp.agentgrid_assert((select count(*)=5 from public.agentgrid_profiles),'moderator can inspect AgentGrid profiles');
select pg_temp.agentgrid_expect_error($statement$insert into public.agentgrid_user_roles(user_id,role) values(public.agentgrid_profile_id(),'administrator')$statement$,'42501');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_has_role(array['administrator']),'admin role is authoritative');
select pg_temp.agentgrid_assert((select count(*)=3 from public.agentgrid_user_roles),'admin can inspect AgentGrid staff roles');
select pg_temp.agentgrid_expect_error($statement$insert into public.picmagic_admin_fixture(user_id) values(auth.uid())$statement$,'42501');
select pg_temp.agentgrid_expect_error('select public.picmagic_admin_only_fixture()','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'AgentGrid admin gains no protected application access');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(not public.agentgrid_is_member(),'suspended membership is inactive');
select pg_temp.agentgrid_assert(not public.agentgrid_has_role(array['administrator']),'suspended admin loses authority');
select pg_temp.agentgrid_expect_error('select pg_temp.agentgrid_quota_probe()','42501');
reset role;

set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_assert(not public.agentgrid_is_member(),'shared non-member remains outside AgentGrid');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_profiles),'forged metadata exposes no private AgentGrid profiles');
select pg_temp.agentgrid_expect_error('select public.picmagic_admin_only_fixture()','42501');
reset role;

set local role service_role;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_profiles','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_rate_limits','42501');
reset role;
select pg_temp.agentgrid_assert(public.agentgrid_anonymous_username('10000000-0000-4000-8000-000000000003') <> public.agentgrid_anonymous_username('10000000-0000-4000-8000-000000000004'),'anonymized handles preserve the full UUID without truncation collisions');
create role agentgrid_fixture_auth_admin nologin;
grant agentgrid_fixture_auth_admin to postgres with set true;
grant usage on schema auth to agentgrid_fixture_auth_admin;
grant select, delete on auth.users to agentgrid_fixture_auth_admin;
set local role agentgrid_fixture_auth_admin;
delete from auth.users where id='00000000-0000-4000-8000-000000000001';
reset role;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_identities where user_id='00000000-0000-4000-8000-000000000001'),'shared deletion detaches identity');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_profiles where display_name='Deleted creator' and status='deactivated' and bio='' and website_url is null),'business identity survives with personal profile data cleared');
set local request.jwt.claims = '{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_profile_id() is null,'old JWT no longer resolves to a profile');
select pg_temp.agentgrid_assert(not public.agentgrid_is_member(),'old JWT no longer has membership');
reset role;
rollback;
