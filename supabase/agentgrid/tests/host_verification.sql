-- Synthetic submitted bundles only. No real staff role or publication is seeded.
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
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,editorial,category_slug,submitted_by,created_at)
select ('30000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',i||'.0.0',
 jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}','"submission-fixture"'),'{version}',to_jsonb(i||'.0.0')),
 '{"submitted_context":"private submitted evidence"}','productivity','10000000-0000-4000-8000-000000000001',now()+i*interval '1 second'
 from generate_series(1,23) i;
insert into public.agentgrid_submissions(version_id,created_at)
select id,created_at from public.agentgrid_agent_versions;
create temporary table agentgrid_fixture_run(document jsonb);
insert into agentgrid_fixture_run values('{"origin":"real-host","platform_slug":"chatgpt","host_version":"Synthetic SQL fixture only","scenario":"normal","specification_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","completed_on":"2026-10-08","input":"Synthetic SQL input; not a real host run. This tests only persistence and authority boundaries.","observed_output":"Synthetic SQL output; not a real host run. This tests only persistence and authority boundaries.","assertions":[{"description":"Synthetic test assertion A; this is not production evidence.","passed":false},{"description":"Synthetic test assertion B; this is not production evidence.","passed":true}],"reviewer_notes":"Synthetic SQL review only. Never publish or treat this test record as real verification evidence."}');
grant select on agentgrid_fixture_run to authenticated;
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_host_runs(''30000000-0000-4000-8000-000000000001'')','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_host_verification_runs','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_host_runs(''30000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_record_host_run(''40000000-0000-4000-8000-000000000001'',''30000000-0000-4000-8000-000000000001'',repeat(''0'',64),(select document from agentgrid_fixture_run))','40001');
select pg_temp.agentgrid_assert(public.agentgrid_record_host_run('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'contentDigest',(select document from agentgrid_fixture_run))->>'id'='40000000-0000-4000-8000-000000000001','exact private receipt');
select public.agentgrid_record_host_run('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'contentDigest',(select document from agentgrid_fixture_run));
select pg_temp.agentgrid_assert(not(public.agentgrid_staff_host_runs('30000000-0000-4000-8000-000000000001')::text like '%observed_output%'),'list omits large private observations');
select pg_temp.agentgrid_assert(public.agentgrid_staff_host_run('40000000-0000-4000-8000-000000000001')#>>'{run,origin}'='real-host','staff-only detail available');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_host_runs('30000000-0000-4000-8000-000000000001')->'runs')=1,'idempotent retry creates no duplicates');
select pg_temp.agentgrid_assert(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'state'='pending','recording a test never approves a submission');
select pg_temp.agentgrid_expect_error('select public.agentgrid_record_host_run(''40000000-0000-4000-8000-000000000001'',''30000000-0000-4000-8000-000000000001'',public.agentgrid_staff_submission(''30000000-0000-4000-8000-000000000001'')->>''contentDigest'',(select document from agentgrid_fixture_run)||''{"scenario":"adversarial-input"}''::jsonb)','40001');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_host_verification_runs','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_host_run_receipt(''40000000-0000-4000-8000-000000000001'')','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'staff evidence grants no PicMagic access');
reset role;
select pg_temp.agentgrid_expect_error('update public.agentgrid_host_verification_runs set run=''{}''','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_host_verification_runs','55000');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_host_runs(''30000000-0000-4000-8000-000000000001'')','42501');
reset role;
rollback;
