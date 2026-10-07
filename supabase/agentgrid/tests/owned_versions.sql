-- Disposable actor fixtures only. This file never targets the shared project.
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
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'version_fixture_'||i,'Version fixture '||i,'fixture-v1','fixture-v1' from generate_series(1,3) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000002','moderator'),('10000000-0000-4000-8000-000000000003','administrator');
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','owned-version-fixture','10000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000002','other-version-fixture','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,editorial,category_slug,submitted_by,created_at)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',i||'.0.0',
 jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}','"owned-version-fixture"'),
 '{"private_fixture":"must not enter the history projection"}',
 'productivity','10000000-0000-4000-8000-000000000001',now()-i*interval '1 second' from generate_series(1,22) i;
insert into public.agentgrid_submissions(version_id,state,reason,reviewed_by,reviewed_at)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
 case when i=1 then 'pending' else 'rejected' end,
 case when i=1 then '' else 'Synthetic rejection for acceptance only.' end,
 case when i=1 then null else '10000000-0000-4000-8000-000000000002'::uuid end,
 case when i=1 then null else now() end from generate_series(1,22) i;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001',0)->'versions')=21,'bounded history lookahead');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001',20)->'versions')=2,'remaining history page');
select pg_temp.agentgrid_assert(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')->>'submissionEnabled'='false','managed submissions disabled by default');
select pg_temp.agentgrid_assert((public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')#>>'{versions,0,state}')='pending','live pending state');
select pg_temp.agentgrid_assert(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001',20)->>'pendingVersionId'='30000000-0000-4000-8000-000000000001','pending gate independent from pagination');
select pg_temp.agentgrid_assert(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001',20)->>'latestVersion'='22.0.0','highest version independent from page and lexical sorting');
select pg_temp.agentgrid_assert(not (public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')::text like '%private_fixture%'),'private editorial absent');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000002'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(null)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'',-1)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'',10000)','23514');
select public.agentgrid_decide_submission('30000000-0000-4000-8000-000000000001','withdrawn','Synthetic owner withdrawal of the pending version.');
select pg_temp.agentgrid_assert((public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')#>>'{versions,0,state}')='withdrawn','owner withdrawal immediately visible');
reset role;
update public.agentgrid_configuration set submission_enabled=true where singleton;
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')->>'submissionEnabled'='true','managed enabling visible');
reset role;
update public.agentgrid_agents set status='archived' where id='20000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_owned_versions('20000000-0000-4000-8000-000000000001')->>'submissionEnabled'='false','archived resource cannot submit');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_versions(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
select pg_temp.agentgrid_assert(not has_function_privilege('anon','public.agentgrid_owned_versions(uuid,integer)','execute'),'anonymous history denied');
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_owned_versions(uuid,integer)','execute'),'no privileged creator authority');
rollback;
