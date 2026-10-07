-- This is synthetic acceptance data. It never represents a real review or host test.
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
create function pg_temp.agentgrid_spec(slug text, version text default '1.0.0', licensed boolean default true)
returns jsonb language sql as $$
 select jsonb_set(jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,
 '{identity,slug}',to_jsonb(slug)),'{version}',to_jsonb(version)),
 '{license}',case when licensed then '{"identifier":"MIT","statement":"Synthetic fixture license, never an actual released package.","permissions":{"use":true,"modify":true,"redistribute":true,"public_fork":true}}'::jsonb
 else current_setting('agentgrid.fixture_specification')::jsonb->'license' end);
$$;
create function pg_temp.agentgrid_evidence(version_id uuid)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('contract_version','0.1','content_digest',content_digest,
 'editorial_passed',true,'host_checks_passed',true,'security_review_passed',true)
 from public.agentgrid_agent_versions where id=version_id;
$$;
create temp table agentgrid_fixture_state (key text primary key,resource_id uuid,version_id uuid);
grant select,insert,update on agentgrid_fixture_state to anon,authenticated,service_role;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,5) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000003','moderator'),('10000000-0000-4000-8000-000000000004','administrator');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000005';

set local role anon;
select pg_temp.agentgrid_assert((select count(*)=10 from public.agentgrid_categories),'broad category vocabulary is available');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agents),'no unapproved resources are public');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_drafts','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_submissions','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_releases','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-original',pg_temp.agentgrid_spec('fixture-original'))$s$,'42501');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-spoof',pg_temp.agentgrid_spec('fixture-spoof')||'{"owner_id":"another-user"}'::jsonb)$s$,'23514');
insert into agentgrid_fixture_state(key,resource_id)
values('original',public.agentgrid_create_agent('fixture-original',pg_temp.agentgrid_spec('fixture-original','1.0.0',false)));
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_drafts),'owner sees own private draft');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),7,pg_temp.agentgrid_spec('fixture-original'))$s$,'40001');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),1)$s$,'42501');
reset role;
update public.agentgrid_configuration set submission_enabled=true;
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),1)$s$,'23514');
select pg_temp.agentgrid_assert(public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),1,pg_temp.agentgrid_spec('fixture-original'))=2,'save advances revision atomically');
update agentgrid_fixture_state set version_id=public.agentgrid_submit_version(resource_id,2) where key='original';
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),2)$s$,'23505');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_submissions where state='pending'),'submission starts pending');
select pg_temp.agentgrid_expect_error('update public.agentgrid_agent_versions set version=''9.9.9''','42501');
select pg_temp.agentgrid_expect_error('update public.agentgrid_agents set owner_id=public.agentgrid_profile_id()','42501');
reset role;
select pg_temp.agentgrid_expect_error('update public.agentgrid_agent_versions set specification=specification','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_agent_versions','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_version_platforms','55000');

set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agents),'submitted is not published');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agent_versions),'pending payload remains private');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_version_platforms),'private version mappings remain private');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_drafts),'other member cannot read a private draft');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_submissions),'other member cannot read its review state');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),2,pg_temp.agentgrid_spec('fixture-original'))$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-premature',pg_temp.agentgrid_spec('fixture-premature'),(select version_id from agentgrid_fixture_state where key='original'))$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='original'),'rejected','An unauthorized rejection attempt')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agent_versions),'moderator sees the immutable submitted payload');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_drafts),'moderator does not read private working drafts');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='original'),'approved','Bypass the prepared publication gate')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),public.agentgrid_profile_id(),'bad','{}')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),public.agentgrid_profile_id(),'bad','{}')$s$,'42501');
reset role;

set local role service_role;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_releases','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000002','bad','{}')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003','bad',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')))$s$,'23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',jsonb_set(pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')),'{host_checks_passed}','false'))$s$,'23514');
select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),
 '10000000-0000-4000-8000-000000000003',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')));
reset role;
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agents),'approved resource becomes live');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agent_versions),'approved immutable content is readable');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_version_platforms),'public mappings are readable');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_submissions','42501');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),2)$s$,'23505');
select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),2,pg_temp.agentgrid_spec('fixture-original','1.0.1'));
insert into agentgrid_fixture_state(key,resource_id,version_id)
select 'successor',resource_id,public.agentgrid_submit_version(resource_id,3) from agentgrid_fixture_state where key='original';
reset role;
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_agent_versions),'new pending version does not expose itself or replace the public version');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='successor'),'withdrawn','Withdraw this synthetic draft to make a revised version.');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='successor'),'withdrawn','Repeated withdrawal is invalid')$s$,'42501');
select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),3,pg_temp.agentgrid_spec('fixture-original','1.0.10'));
insert into agentgrid_fixture_state(key,resource_id,version_id)
select 'numeric-successor',resource_id,public.agentgrid_submit_version(resource_id,4) from agentgrid_fixture_state where key='original';
select public.agentgrid_decide_submission((select version_id from agentgrid_fixture_state where key='numeric-successor'),'withdrawn','Withdraw the synthetic numeric successor.');
select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),4,pg_temp.agentgrid_spec('fixture-original','1.0.2'));
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_submit_version((select resource_id from agentgrid_fixture_state where key='original'),5)$s$,'23514');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-license-theft',pg_temp.agentgrid_spec('fixture-license-theft','1.0.0',false),(select version_id from agentgrid_fixture_state where key='original'))$s$,'23514');
insert into agentgrid_fixture_state(key,resource_id) values('fork',public.agentgrid_create_agent(
 'fixture-public-fork',pg_temp.agentgrid_spec('fixture-public-fork'),(select version_id from agentgrid_fixture_state where key='original')));
select pg_temp.agentgrid_assert((select forked_from_version_id=(select version_id from agentgrid_fixture_state where key='original')
 from public.agentgrid_agents where slug='fixture-public-fork'),'fork points at the exact immutable source');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='fork'),1,pg_temp.agentgrid_spec('fixture-public-fork','1.0.0',false))$s$,'23514');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_agent('fixture-suspended',pg_temp.agentgrid_spec('fixture-suspended'))$s$,'42501');
reset role;
rollback;
