-- Disposable synthetic publication only; never seeds production content.
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
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,3) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,3) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,3) i;
update public.agentgrid_configuration set first_party_profile_id='10000000-0000-4000-8000-000000000001';
insert into public.agentgrid_user_roles(user_id,role) values ('10000000-0000-4000-8000-000000000003','administrator');
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','fixture-source','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,editorial,category_slug,submitted_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1.0.0',
 jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}','"fixture-source"'),'{license}',
 '{"identifier":"custom","statement":"Synthetic hosted-only license for isolated acceptance only.","public_fork_scope":"agentgrid-only","permissions":{"use":true,"modify":true,"redistribute":false,"public_fork":true}}'),
 '{"private_editorial":"must not transfer"}','productivity','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_submissions(version_id,state,reviewed_by,reviewed_at) values
 ('30000000-0000-4000-8000-000000000001','approved','10000000-0000-4000-8000-000000000003',now());
insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','{}');
-- The hosted exception must not bypass any other grant validation.
do $$ declare definition jsonb; invalid jsonb;
begin
 select specification into definition from public.agentgrid_agent_versions where id='30000000-0000-4000-8000-000000000001';
 perform public.agentgrid_check_resource(definition,'fixture-source');
 foreach invalid in array array[
   definition #- '{license,public_fork_scope}',
   jsonb_set(definition,'{license,public_fork_scope}','null'),
   jsonb_set(definition,'{license,public_fork_scope}','"everywhere"'),
   jsonb_set(definition,'{license,permissions,use}','false'),
   jsonb_set(definition,'{license,permissions,modify}','false'),
   jsonb_set(definition,'{license,permissions,redistribute}','true'),
   jsonb_set(definition,'{license,permissions,public_fork}','false'),
   jsonb_set(definition,'{license,identifier}','"MIT"')
 ] loop
   perform pg_temp.agentgrid_expect_error(format('select public.agentgrid_check_resource(%L::jsonb,%L)',invalid,'fixture-source'),'23514');
 end loop;
end $$;
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_source(''30000000-0000-4000-8000-000000000001'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_agent(''30000000-0000-4000-8000-000000000001'',''fixture-fork'',''Fixture fork'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-999999999999","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_source(''30000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_fork_source('30000000-0000-4000-8000-000000000001')->>'creatorName'='AgentGrid Editorial','first-party attribution retained');
select pg_temp.agentgrid_assert(public.agentgrid_fork_agent('30000000-0000-4000-8000-000000000001','fixture-fork','Fixture Fork')->>'created'='true','fork created');
select pg_temp.agentgrid_assert(public.agentgrid_fork_agent('30000000-0000-4000-8000-000000000001','fixture-fork','Fixture Fork')->>'created'='false','same request recovers existing resource');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agents where slug='fixture-fork'),'retry creates no duplicates');
select pg_temp.agentgrid_assert((select d.editorial='{}'::jsonb and d.specification#>>'{identity,slug}'='fixture-fork'
 and d.specification#>>'{identity,name}'='Fixture Fork' and d.specification->>'version'='0.1.0'
 and a.forked_from_version_id='30000000-0000-4000-8000-000000000001'::uuid
 from public.agentgrid_drafts d join public.agentgrid_agents a on a.id=d.agent_id where a.slug='fixture-fork'),'private draft has immutable source and fresh identity, no copied editorial');
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_agent(''30000000-0000-4000-8000-000000000001'',''fixture-source'',''Fixture Fork'')','23505');
select pg_temp.agentgrid_assert((select d.specification#>>'{license,public_fork_scope}'='agentgrid-only'
 and d.specification#>>'{license,permissions,redistribute}'='false'
 from public.agentgrid_drafts d join public.agentgrid_agents a on a.id=d.agent_id where a.slug='fixture-fork'),'hosted fork preserves restricted distribution');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft(
 (select id from public.agentgrid_agents where slug='fixture-fork'),1,
 (select jsonb_set(d.specification #- '{license,public_fork_scope}','{license,permissions,redistribute}','true')
 from public.agentgrid_drafts d join public.agentgrid_agents a on a.id=d.agent_id where a.slug='fixture-fork'))$s$,'23514');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'fork grants no protected app access');
reset role;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_releases),'fork never publishes');
select pg_temp.agentgrid_assert((select d.specification->'license'=v.specification->'license'
 and d.specification#>>'{execution,instructions}'=v.specification#>>'{execution,instructions}'
 from public.agentgrid_drafts d join public.agentgrid_agents a on a.id=d.agent_id
 join public.agentgrid_agent_versions v on v.id=a.forked_from_version_id where a.slug='fixture-fork'),'instructions and rights copied exactly');
update public.agentgrid_agents set status='blocked' where slug='fixture-source';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_fork_source('30000000-0000-4000-8000-000000000001') is null,'blocked source concealed');
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_agent(''30000000-0000-4000-8000-000000000001'',''fixture-another'',''Fixture Fork'')','42501');
select pg_temp.agentgrid_assert(public.agentgrid_fork_agent('30000000-0000-4000-8000-000000000001','fixture-fork','Fixture Fork')->>'created'='false','existing owned fork remains recoverable after source blocking');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_fork_agent(''30000000-0000-4000-8000-000000000001'',''fixture-fork'',''Fixture Fork'')','42501');
reset role;
-- Complete ancestry must remain representable by the public lineage projection.
do $$ declare parent uuid:='30000000-0000-4000-8000-000000000001'; child uuid; version_id uuid;
begin
 for i in 1..32 loop
  insert into public.agentgrid_agents(slug,owner_id,forked_from_version_id)
  values('fixture-chain-'||i,'10000000-0000-4000-8000-000000000001',parent) returning id into child;
  insert into public.agentgrid_agent_versions(agent_id,version,specification,category_slug,submitted_by)
  values(child,'1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'productivity','10000000-0000-4000-8000-000000000001') returning id into version_id;
  parent:=version_id;
 end loop;
 perform pg_temp.agentgrid_expect_error(format('insert into public.agentgrid_agents(slug,owner_id,forked_from_version_id) values(%L,%L,%L)','fixture-too-deep','10000000-0000-4000-8000-000000000001',parent),'23514');
end $$;
rollback;
