-- Synthetic actor/resource fixtures only, inside disposable PostgreSQL. Roll back.
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
  raise exception 'Unexpected SQLSTATE %, expected %',sqlstate,expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised',expected;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'save_fixture_'||i,'Save fixture '||i,'fixture-v1','fixture-v1' from generate_series(1,3) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000002','moderator'),('10000000-0000-4000-8000-000000000003','administrator');
insert into public.agentgrid_agents(id,slug,owner_id)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'saved-fixture-'||i,'10000000-0000-4000-8000-000000000002' from generate_series(1,22) i;
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,category_slug,submitted_by)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'1.0.0',
 jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}',to_jsonb('saved-fixture-'||i)),
 'productivity','10000000-0000-4000-8000-000000000002' from generate_series(1,22) i;
insert into public.agentgrid_submissions(version_id,state,reviewed_by,reviewed_at)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'approved','10000000-0000-4000-8000-000000000003',now() from generate_series(1,22) i;
insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest)
select ('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 '10000000-0000-4000-8000-000000000003','{}' from generate_series(1,22) i;
insert into public.agentgrid_favorites(profile_id,agent_id,created_at)
select '10000000-0000-4000-8000-000000000001',('20000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 now()-i*interval '1 second' from generate_series(1,22) i;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=21 from public.agentgrid_saved_agents(0)),'projection bounded with one lookahead');
select pg_temp.agentgrid_assert((select count(*)=2 from public.agentgrid_saved_agents(20)),'remaining saved page');
select pg_temp.agentgrid_assert((select count(distinct agent_id)=22 from (select agent_id from public.agentgrid_saved_agents(0) limit 20) a full join (select agent_id from public.agentgrid_saved_agents(20)) b using(agent_id)),'stable pagination has no missing resources');
select pg_temp.agentgrid_assert(public.agentgrid_resource_save_state('20000000-0000-4000-8000-000000000001')->>'saved'='true','actual saved state');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_saved_agents(-1)','23514');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_saved_agents(10000)','23514');
reset role;
update public.agentgrid_agents set status='blocked' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_assert((select not available and slug is null and title is null and summary is null and category_slug is null from public.agentgrid_saved_agents(0) where agent_id='20000000-0000-4000-8000-000000000001'),'blocked saved source exposes no private content');
select pg_temp.agentgrid_assert(public.agentgrid_resource_save_state('20000000-0000-4000-8000-000000000001')->>'available'='false','live withdrawal recognized');
select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',false);
select pg_temp.agentgrid_assert(public.agentgrid_resource_save_state('20000000-0000-4000-8000-000000000001')->>'saved'='false','withdrawn saved resource remains removable');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_saved_agents(0)),'creator/moderator cannot read another saved list');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_saved_agents(0)),'administrator cannot read another saved list');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_saved_agents(0)','42501');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_saved_agents(0)','42501');
reset role;
select pg_temp.agentgrid_assert(not has_function_privilege('anon','public.agentgrid_saved_agents(integer)','execute'),'anonymous saves denied');
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_resource_save_state(uuid)','execute'),'no privileged save authority');
rollback;
