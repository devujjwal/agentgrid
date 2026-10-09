-- Synthetic throughput acceptance only; never targets a real publisher account.
begin;
create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'Assertion failed: %',explanation; end if;
end $$;
create function pg_temp.agentgrid_expect_error(statement text, expected text) returns void
language plpgsql as $$ begin
 begin execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %',sqlstate,expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised',expected;
end $$;
create function pg_temp.agentgrid_spec(slug text) returns jsonb language sql as $$
 select jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,
 '{identity,slug}',to_jsonb(slug)),'{license}',
 '{"identifier":"MIT","statement":"Synthetic acceptance fixture; not a real license grant.","permissions":{"use":true,"modify":true,"redistribute":true,"public_fork":true}}');
$$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'editorial_fixture_'||i,'Editorial fixture '||i,'fixture-v1','fixture-v1' from generate_series(1,4) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000001','administrator'),
 ('10000000-0000-4000-8000-000000000003','administrator'),
 ('10000000-0000-4000-8000-000000000004','moderator');
update public.agentgrid_configuration set submission_enabled=true,
 first_party_profile_id='10000000-0000-4000-8000-000000000001';
select pg_temp.agentgrid_assert((select editorial_authoring_until is null from public.agentgrid_configuration),'allowance is disabled by default');
insert into public.agentgrid_rate_limits(user_id,action,window_started_at,count)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,action,now()-interval '1 hour',10
from generate_series(1,4) i cross join (values('create_agent'),('submit'),('fork')) a(action);
create temp table agentgrid_editorial_fixture(key text primary key,id uuid);
grant select,insert,update on agentgrid_editorial_fixture to authenticated;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-default',pg_temp.agentgrid_spec('editorial-default'))$s$,'P0001');
select pg_temp.agentgrid_expect_error('update public.agentgrid_configuration set editorial_authoring_until=now()+interval ''1 day''','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_enforce_authoring_quota(''create_agent'')','42501');
reset role;
update public.agentgrid_configuration set editorial_authoring_until=now()+interval '1 day';
set local role authenticated;
insert into agentgrid_editorial_fixture values('eleven',public.agentgrid_create_agent('editorial-eleven',pg_temp.agentgrid_spec('editorial-eleven')));
select public.agentgrid_submit_version((select id from agentgrid_editorial_fixture where key='eleven'),1);
reset role;
select pg_temp.agentgrid_assert((select bool_and(count=11 and window_started_at=now()-interval '1 hour') from public.agentgrid_rate_limits where user_id='10000000-0000-4000-8000-000000000001' and action in ('create_agent','submit')),'existing counters increment without window reset');
update public.agentgrid_rate_limits set count=39 where user_id='10000000-0000-4000-8000-000000000001' and action in ('create_agent','submit');
set local role authenticated;
insert into agentgrid_editorial_fixture values('forty',public.agentgrid_create_agent('editorial-forty',pg_temp.agentgrid_spec('editorial-forty')));
select public.agentgrid_submit_version((select id from agentgrid_editorial_fixture where key='forty'),1);
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-forty-one',pg_temp.agentgrid_spec('editorial-forty-one'))$s$,'P0001');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select id from agentgrid_editorial_fixture where key='forty'),1)$s$,'P0001');
reset role;
select pg_temp.agentgrid_assert((select bool_and(count=40 and window_started_at=now()-interval '1 hour') from public.agentgrid_rate_limits where user_id='10000000-0000-4000-8000-000000000001' and action in ('create_agent','submit')),'failed actions roll back and cap stays forty');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_releases),'extra authoring never releases a resource');
select pg_temp.agentgrid_assert((select count(*)=2 from public.agentgrid_submissions where state='pending'),'immutable versions still await review');
update public.agentgrid_rate_limits set count=39 where user_id='10000000-0000-4000-8000-000000000001' and action='create_agent';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-fork',pg_temp.agentgrid_spec('editorial-fork'),'30000000-0000-4000-8000-000000000001')$s$,'P0001');
reset role;
select pg_temp.agentgrid_assert((select count=10 from public.agentgrid_rate_limits where user_id='10000000-0000-4000-8000-000000000001' and action='fork'),'fork ceiling stays ten');

update public.agentgrid_configuration set editorial_authoring_until=now()-interval '1 second';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-expired',pg_temp.agentgrid_spec('editorial-expired'))$s$,'P0001');
reset role;
update public.agentgrid_configuration set editorial_authoring_until=now()+interval '1 day';
delete from public.agentgrid_user_roles where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-revoked',pg_temp.agentgrid_spec('editorial-revoked'))$s$,'P0001');
reset role;
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','administrator');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-suspended',pg_temp.agentgrid_spec('editorial-suspended'))$s$,'42501');
reset role;
update public.agentgrid_profiles set status='active' where id='10000000-0000-4000-8000-000000000001';

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"administrator"}}';
update public.agentgrid_rate_limits set count=9 where user_id='10000000-0000-4000-8000-000000000002' and action='create_agent';
set local role authenticated;
select public.agentgrid_create_agent('editorial-member-ten',pg_temp.agentgrid_spec('editorial-member-ten'));
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-member',pg_temp.agentgrid_spec('editorial-member'))$s$,'P0001');
reset role;
update public.agentgrid_configuration set first_party_profile_id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-non-admin',pg_temp.agentgrid_spec('editorial-non-admin'))$s$,'P0001');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-other-admin',pg_temp.agentgrid_spec('editorial-other-admin'))$s$,'P0001');
reset role;
update public.agentgrid_configuration set first_party_profile_id='10000000-0000-4000-8000-000000000004';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-moderator',pg_temp.agentgrid_spec('editorial-moderator'))$s$,'P0001');
reset role;

update public.agentgrid_configuration set first_party_profile_id='10000000-0000-4000-8000-000000000001',submission_enabled=false;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('editorial-disabled',pg_temp.agentgrid_spec('editorial-disabled'))$s$,'P0001');
reset role;
update public.agentgrid_rate_limits set count=1 where user_id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select id from agentgrid_editorial_fixture where key='eleven'),1)$s$,'42501');
reset role;
select pg_temp.agentgrid_expect_error('select public.agentgrid_enforce_authoring_quota(''report'')','23514');
select pg_temp.agentgrid_assert(not has_function_privilege('anon','public.agentgrid_enforce_authoring_quota(text)','execute') and not has_function_privilege('authenticated','public.agentgrid_enforce_authoring_quota(text)','execute') and not has_function_privilege('service_role','public.agentgrid_enforce_authoring_quota(text)','execute'),'quota helper has no application grant');
-- Natural expiry still resets the same ordinary quota window.
update public.agentgrid_configuration set editorial_authoring_until=null;
update public.agentgrid_rate_limits set count=40,window_started_at=now()-interval '25 hours' where user_id='10000000-0000-4000-8000-000000000001' and action='create_agent';
set local role authenticated;
select public.agentgrid_create_agent('editorial-natural-reset',pg_temp.agentgrid_spec('editorial-natural-reset'));
reset role;
select pg_temp.agentgrid_assert((select count=1 and window_started_at>now()-interval '1 minute' from public.agentgrid_rate_limits where user_id='10000000-0000-4000-8000-000000000001' and action='create_agent'),'natural reset stays effective');
rollback;
