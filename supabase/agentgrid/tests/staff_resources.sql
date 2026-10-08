-- Synthetic resource moderation only. No real staff role or publication is seeded.
begin;
create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin if condition is distinct from true then raise exception 'Assertion failed: %',explanation; end if; end $$;
create function pg_temp.agentgrid_expect_error(statement text,expected text) returns void
language plpgsql as $$ begin
 begin execute statement; exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %',sqlstate,expected;
 end; raise exception 'Expected SQLSTATE % was not raised',expected;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'submission_fixture_'||i,'Submission fixture '||i,'fixture-v1','fixture-v1' from generate_series(1,3) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000002','moderator'),('10000000-0000-4000-8000-000000000003','administrator');
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','submission-fixture','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_drafts(agent_id,specification,editorial) values
 ('20000000-0000-4000-8000-000000000001','{"private_working_draft":"not submitted"}','{}');

set local role anon;
select pg_temp.agentgrid_expect_error('select moderation_reason from public.agentgrid_agents','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_resource(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_resource(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select moderation_reason from public.agentgrid_agents','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',0,null,''blocked'',''Owner cannot self-moderate this resource.'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_resource('20000000-0000-4000-8000-000000000001')->>'revision'='0','initial bounded projection');
select pg_temp.agentgrid_assert(not(public.agentgrid_staff_resource('20000000-0000-4000-8000-000000000001')::text like '%private_working_draft%'),'no draft data');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'staff gains no PicMagic access');
select pg_temp.agentgrid_expect_error('select public.agentgrid_moderate_agent(''20000000-0000-4000-8000-000000000001'',true,''Legacy bypass must not be available.'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',0,''30000000-0000-4000-8000-000000000001'',''blocked'',''Different release must be refused.'')','40001');
select pg_temp.agentgrid_assert(public.agentgrid_decide_resource('20000000-0000-4000-8000-000000000001',0,null,'blocked','Synthetic safety investigation requires restriction.')->>'revision'='1','block increments revision');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',0,null,''active'',''Stale restore must not override newer action.'')','40001');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',1,null,''blocked'',''Duplicate action must not append a new decision.'')','40001');
select pg_temp.agentgrid_assert(public.agentgrid_decide_resource('20000000-0000-4000-8000-000000000001',1,null,'active','Synthetic investigation complete; restore access.')->>'revision'='2','restore increments revision');
select pg_temp.agentgrid_assert((select count(*)=2 from public.agentgrid_moderation_actions where agent_id='20000000-0000-4000-8000-000000000001'),'each accepted decision audited once');
select pg_temp.agentgrid_expect_error('update public.agentgrid_agents set status=''blocked''','42501');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.agentgrid_decide_resource('20000000-0000-4000-8000-000000000001',2,null,'blocked','Synthetic suspended owner resource restriction.');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',3,null,''active'',''Suspended owner cannot be restored indirectly.'')','42501');
reset role;
update public.agentgrid_profiles set status='active' where id='10000000-0000-4000-8000-000000000001';
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_resource('20000000-0000-4000-8000-000000000001')->>'ownerIsSelf'='true','self ownership is explicit');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',3,null,''active'',''Self restoration requires another moderator.'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_decide_resource('20000000-0000-4000-8000-000000000001',3,null,'active','Administrator can restore after owner reactivation.')->>'status'='active','administrator path');
reset role;
update public.agentgrid_agents set status='archived' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_resource('20000000-0000-4000-8000-000000000001')->>'revision'='5','archive advances revision too');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_resource(''20000000-0000-4000-8000-000000000001'',5,null,''active'',''Archived resources cannot be restored through moderation.'')','42501');
reset role;
delete from public.agentgrid_user_roles where user_id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_resource(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
rollback;
