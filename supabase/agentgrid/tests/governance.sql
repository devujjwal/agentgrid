begin;
create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin
 if condition is distinct from true then raise exception 'Assertion failed: %', explanation; end if;
end $$;
create function pg_temp.agentgrid_expect_error(statement text, expected text) returns void
language plpgsql as $$ begin
 begin execute statement;
 exception when others then
  if sqlstate=expected then return; end if;
  raise exception 'Unexpected SQLSTATE %, expected %', sqlstate, expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised', expected;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,4) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000003','moderator'),('10000000-0000-4000-8000-000000000004','administrator');
-- Retained immutable records must never block managed identity deletion.
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','fixture-governance-resource','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_drafts(agent_id,specification) values
 ('20000000-0000-4000-8000-000000000001',current_setting('agentgrid.fixture_specification')::jsonb);
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,category_slug,submitted_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'productivity','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_submissions(version_id) values('30000000-0000-4000-8000-000000000001');
insert into public.agentgrid_favorites(profile_id,agent_id) values('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_change_role('10000000-0000-4000-8000-000000000002','administrator',true,'Unauthorized self-promotion attempt')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000002','fixture_actor_1')$s$,'23514');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_change_role('10000000-0000-4000-8000-000000000003','administrator',true,'Moderator self-promotion attempt')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_moderate_profile('10000000-0000-4000-8000-000000000004',true,'A moderator cannot suspend an administrator')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_change_role('10000000-0000-4000-8000-000000000004','administrator',false,'Attempt to remove last administrator')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_moderate_profile('10000000-0000-4000-8000-000000000004',true,'Attempt to suspend last administrator')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000004','fixture_actor_4')$s$,'42501');
select public.agentgrid_change_role('10000000-0000-4000-8000-000000000003','administrator',true,'Synthetic administrator delegation for acceptance.');
select public.agentgrid_moderate_profile('10000000-0000-4000-8000-000000000001',true,'Synthetic suspension acceptance only.');
reset role;
select pg_temp.agentgrid_assert((select status='suspended' from public.agentgrid_profiles where id='10000000-0000-4000-8000-000000000001'),'administrator can suspend an AgentGrid profile');
set local role authenticated;
select public.agentgrid_moderate_profile('10000000-0000-4000-8000-000000000001',false,'Synthetic restoration acceptance only.');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_has_role(array['administrator']),'delegated role is active without a replacement JWT');
select public.agentgrid_change_role('10000000-0000-4000-8000-000000000004','administrator',false,'Synthetic role revocation acceptance only.');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(not public.agentgrid_has_role(array['administrator']),'revocation takes effect on the existing JWT');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_change_role('10000000-0000-4000-8000-000000000004','administrator',true,'A stale JWT must not regain its old role')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_change_role('10000000-0000-4000-8000-000000000004','administrator',true,'Synthetic restoration of administrator role.');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000004','fixture_actor_4');
select pg_temp.agentgrid_assert(public.agentgrid_profile_id() is null,'deactivated administrator loses identity link');
reset role;
select pg_temp.agentgrid_assert((select count(*)=1 from auth.users where id='00000000-0000-4000-8000-000000000004'),'AgentGrid deactivation leaves shared identity untouched');

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000002','fixture_actor_2');
select pg_temp.agentgrid_assert(public.agentgrid_profile_id() is null,'old user JWT cannot access deactivated account');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_favorites),'private saved state no longer accessible');
reset role;
select pg_temp.agentgrid_assert((select count(*)=1 from auth.users where id='00000000-0000-4000-8000-000000000002'),'shared user remains for other applications');
select pg_temp.agentgrid_assert((select status='deactivated' and visibility='private' and display_name='Deleted creator'
 from public.agentgrid_profiles where id='10000000-0000-4000-8000-000000000002'),'profile is deactivated and deidentified');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_drafts),'private draft content is removed');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_favorites),'private saved rows are removed');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agent_versions),'immutable version still exists for retention/attribution');
select pg_temp.agentgrid_assert((select state='withdrawn' from public.agentgrid_submissions),'pending submission is withdrawn');
select pg_temp.agentgrid_assert((select status='archived' from public.agentgrid_agents),'owned resources are archived');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_moderate_profile('10000000-0000-4000-8000-000000000002',false,'Cannot revive a detached account using moderation')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000003','fixture_actor_3')$s$,'42501');
reset role;
-- A later signup must not be removed by a stale deactivation request.
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
values('10000000-0000-4000-8000-000000000005','fixture_actor_2','Re-created synthetic profile','fixture-v1','fixture-v1');
insert into public.agentgrid_identities(user_id,profile_id) values('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000005');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_deactivate_profile('10000000-0000-4000-8000-000000000002','fixture_actor_2')$s$,'40001');
select pg_temp.agentgrid_assert(public.agentgrid_profile_id()='10000000-0000-4000-8000-000000000005','stale request preserves recreated membership');
select pg_temp.agentgrid_assert(not has_function_privilege('authenticated','public.agentgrid_deactivate_account(text)','execute'),'legacy unbound removal is not callable');
reset role;
-- An external managed deletion must still work even for the last administrator.
delete from auth.users where id='00000000-0000-4000-8000-000000000003';
select pg_temp.agentgrid_assert((select status='deactivated' from public.agentgrid_profiles where id='10000000-0000-4000-8000-000000000003'),'managed deletion is not blocked by AgentGrid governance');
select pg_temp.agentgrid_assert((select count(*)=1 from public.picmagic_private_fixture),'protected fixture data survives every account/staff action');
rollback;
