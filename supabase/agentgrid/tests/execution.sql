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
select pg_temp.agentgrid_assert(public.agentgrid_save_draft((select resource_id from agentgrid_fixture_state where key='original'),1,pg_temp.agentgrid_spec('fixture-original'),'{"overview":"Synthetic frozen guide, not an editorial approval."}')=2,'save advances revision atomically');
update agentgrid_fixture_state set version_id=public.agentgrid_submit_version(resource_id,2) where key='original';
select pg_temp.agentgrid_assert((select editorial->>'overview'='Synthetic frozen guide, not an editorial approval.' from public.agentgrid_agent_versions where id=(select version_id from agentgrid_fixture_state where key='original')),'submission freezes the exact author guide');
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
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_publish_version(uuid,uuid,text,jsonb)','execute'),'legacy publisher bypass revoked');
reset role;
-- Exercise the internal implementation as database owner; public publisher uses reviewed requests.
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000002','bad','{}')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003','bad',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')))$s$,'23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),'10000000-0000-4000-8000-000000000003',pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',jsonb_set(pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')),'{host_checks_passed}','false'))$s$,'23514');
select public.agentgrid_publish_version((select version_id from agentgrid_fixture_state where key='original'),
 '10000000-0000-4000-8000-000000000003',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original'))->>'content_digest',
 pg_temp.agentgrid_evidence((select version_id from agentgrid_fixture_state where key='original')));
reset role;

update public.agentgrid_execution_policy set enabled=true,limit_micros=10000;
insert into public.agentgrid_execution_packages(version_id,enabled) select version_id,true from agentgrid_fixture_state where key='original';
create function pg_temp.execution(op text, data jsonb default '{}') returns jsonb language sql as $$
 select public.agentgrid_server_execution('00000000-0000-4000-8000-000000000001',op,data);
$$;
select pg_temp.execution('overview');
update public.agentgrid_execution_budgets set limit_micros=2000;
create temp table execution_fixture(data jsonb);
insert into execution_fixture select jsonb_build_object('id','40000000-0000-4000-8000-000000000001',
 'ownerId','10000000-0000-4000-8000-000000000001','idempotencyKey','50000000-0000-4000-8000-000000000001',
 'versionId',version_id,'providerIdentity','test-only','instructions','Synthetic instructions','input','Synthetic input',
 'digest',repeat('a',64),'maximumCostMicros',1000) from agentgrid_fixture_state where key='original';
select pg_temp.execution('prepare',(select data from execution_fixture));
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000001','digest',repeat('a',64)))='false','unapproved run cannot spend');
select pg_temp.execution('approve',jsonb_build_object('id','40000000-0000-4000-8000-000000000001','digest',repeat('a',64)));
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000001','digest',repeat('a',64)))='true','approved run reserves allowance');
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000001','digest',repeat('a',64)))='false','duplicate claim cannot spend');
select pg_temp.agentgrid_assert((select held_micros=1000 from public.agentgrid_execution_policy),'global reservation recorded');
select pg_temp.agentgrid_assert(public.agentgrid_server_execution('00000000-0000-4000-8000-000000000002','read','{"id":"40000000-0000-4000-8000-000000000001"}')='null','other owner cannot read run');
select pg_temp.execution('finish','{"id":"40000000-0000-4000-8000-000000000001","state":"uncertain"}');
select pg_temp.agentgrid_assert((select held_micros=1000 from public.agentgrid_execution_policy),'uncertain charge stays held');
select pg_temp.execution('cancel','{"id":"40000000-0000-4000-8000-000000000001"}');
select pg_temp.execution('finish','{"id":"40000000-0000-4000-8000-000000000001","state":"succeeded","billedMicros":400,"output":"Must discard"}');
select pg_temp.agentgrid_assert((select held_micros=0 and spent_micros=400 from public.agentgrid_execution_policy),'settlement refunds unused reservation');
select pg_temp.agentgrid_assert((select state='cancelled' and output is null from public.agentgrid_execution_runs),'cancelled output discarded');
select pg_temp.execution('finish','{"id":"40000000-0000-4000-8000-000000000001","state":"succeeded","billedMicros":400,"output":"Duplicate"}');
select pg_temp.agentgrid_assert((select spent_micros=400 from public.agentgrid_execution_policy),'settlement is idempotent');
-- A second run cannot exceed the member's remaining allowance.
select pg_temp.execution('prepare',(select data||'{"id":"40000000-0000-4000-8000-000000000002","idempotencyKey":"50000000-0000-4000-8000-000000000002","maximumCostMicros":2000}'::jsonb from execution_fixture));
select pg_temp.execution('approve',jsonb_build_object('id','40000000-0000-4000-8000-000000000002','digest',repeat('a',64)));
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000002','digest',repeat('a',64)))='false','member spend limit enforced');
select pg_temp.agentgrid_assert((select state='blocked' and not reserved from public.agentgrid_execution_runs where id='40000000-0000-4000-8000-000000000002'),'blocked run has no reservation');
-- Site-wide allowance is enforced independently of member funding.
update public.agentgrid_execution_budgets set limit_micros=100000 where profile_id='10000000-0000-4000-8000-000000000001';
update public.agentgrid_execution_policy set limit_micros=1000;
select pg_temp.execution('prepare',(select data||'{"id":"40000000-0000-4000-8000-000000000003","idempotencyKey":"50000000-0000-4000-8000-000000000003"}'::jsonb from execution_fixture));
select pg_temp.execution('approve',jsonb_build_object('id','40000000-0000-4000-8000-000000000003','digest',repeat('a',64)));
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000003','digest',repeat('a',64)))='false','site spend limit enforced');
update public.agentgrid_execution_policy set limit_micros=10000;
select pg_temp.execution('prepare',(select data||'{"id":"40000000-0000-4000-8000-000000000004","idempotencyKey":"50000000-0000-4000-8000-000000000004"}'::jsonb from execution_fixture));
select pg_temp.execution('approve',jsonb_build_object('id','40000000-0000-4000-8000-000000000004','digest',repeat('a',64)));
update public.agentgrid_execution_runs set approved_at=now()-interval '16 minutes' where id='40000000-0000-4000-8000-000000000004';
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000004','digest',repeat('a',64)))='false','expired confirmation cannot spend');
select pg_temp.execution('approve',jsonb_build_object('id','40000000-0000-4000-8000-000000000004','digest',repeat('a',64)));
select pg_temp.agentgrid_assert(pg_temp.execution('claim',jsonb_build_object('id','40000000-0000-4000-8000-000000000004','digest',repeat('a',64)))='true','fresh confirmation accepted');
update public.agentgrid_execution_runs set started_at=now()-interval '3 minutes' where id='40000000-0000-4000-8000-000000000004';
select pg_temp.execution('read','{"id":"40000000-0000-4000-8000-000000000004"}');
select pg_temp.agentgrid_assert((select state='uncertain' and reserved from public.agentgrid_execution_runs where id='40000000-0000-4000-8000-000000000004'),'lost worker stays reserved and cannot redispatch');
-- Valid multilingual instruction/input sizes exceed 100 KB together.
select pg_temp.execution('prepare',(select data||jsonb_build_object(
 'id','40000000-0000-4000-8000-000000000005','idempotencyKey','50000000-0000-4000-8000-000000000005',
 'instructions',repeat('界',24000),'input',repeat('界',12000)) from execution_fixture));
select pg_temp.agentgrid_assert((select length(instructions)=24000 and length(input)=12000 from public.agentgrid_execution_runs where id='40000000-0000-4000-8000-000000000005'),'valid multilingual snapshot preserved');
set local role authenticated;
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_execution_runs','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_server_execution('00000000-0000-4000-8000-000000000001','overview')$s$,'42501');
reset role;
rollback;
