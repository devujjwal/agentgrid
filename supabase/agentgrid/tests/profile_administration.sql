begin;
create function pg_temp.agentgrid_assert(condition boolean,explanation text) returns void language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'Assertion failed: %',explanation; end if;
end $$;
create function pg_temp.agentgrid_expect_error(statement text,expected text) returns void language plpgsql as $$ begin
 begin execute statement; exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %',sqlstate,expected;
 end; raise exception 'Expected SQLSTATE %',expected;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3)i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,3)i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3)i;
insert into public.agentgrid_user_roles(user_id,role) values
('10000000-0000-4000-8000-000000000001','administrator'),('10000000-0000-4000-8000-000000000002','moderator');
set local role anon;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_admin_profile('fixture_actor_3')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_admin_profile('fixture_actor_3')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000002',2,'grant-administrator','Moderators cannot promote themselves.')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_admin_profile('fixture_actor_3')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_admin_profile('does_not_exist') is null,'missing username yields no profile');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_admin_profile('fixture_%')$s$,'23514');
select pg_temp.agentgrid_assert((public.agentgrid_admin_profile('fixture_actor_3')->>'revision')::integer=1,'initial member revision');
select pg_temp.agentgrid_assert(not(public.agentgrid_admin_profile('fixture_actor_3') ?| array['email','userId','termsVersion']),'no shared identity or consent details in admin projection');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000001',2,'revoke-administrator','Last administrator cannot be removed.')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000001',2,'suspend','Last administrator cannot be suspended.')$s$,'42501');
select pg_temp.agentgrid_assert((public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',1,'grant-moderator','Synthetic role grant for acceptance only.')->>'revision')::integer=2,'role mutation returns its new revision');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',1,'suspend','Stale decisions must not override role changes.')$s$,'40001');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',2,'grant-moderator','No-op decisions must not create false success.')$s$,'23514');
select pg_temp.agentgrid_assert(public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',2,'suspend','Synthetic suspension for acceptance only.')->>'status'='suspended','suspension receipt is current');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',3,'grant-administrator','Suspended members cannot receive staff authority.')$s$,'42501');
select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',3,'restore','Synthetic restoration for acceptance only.');
reset role;
update public.agentgrid_profiles set bio='Changed after the administrator opened the profile.' where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_profile('10000000-0000-4000-8000-000000000003',4,'suspend','A changed profile must be reviewed again.')$s$,'40001');
select pg_temp.agentgrid_assert(not has_function_privilege('authenticated','public.agentgrid_change_role(uuid,text,boolean,text)','execute'),'legacy role bypass closed');
select pg_temp.agentgrid_assert(not has_function_privilege('authenticated','public.agentgrid_moderate_profile(uuid,boolean,text)','execute'),'legacy status bypass closed');
select pg_temp.agentgrid_assert(not has_function_privilege('authenticated','public.agentgrid_profile_governance_snapshot(uuid)','execute'),'internal projection cannot bypass administrator check');
reset role;
select pg_temp.agentgrid_assert((select count(*)=3 from auth.users),'shared identities remain intact');
select pg_temp.agentgrid_assert((select count(*)=1 from public.picmagic_private_fixture),'protected application data remains intact');
rollback;
