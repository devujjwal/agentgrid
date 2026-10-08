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
 jsonb_set(jsonb_set(jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}','"submission-fixture"'),'{version}',to_jsonb(i||'.0.0')),'{license}', '{"identifier":"MIT","statement":"Synthetic SQL fixture license only.","permissions":{"use":true,"modify":true,"redistribute":true,"public_fork":true}}'),
 '{"submitted_context":"private submitted evidence"}','productivity','10000000-0000-4000-8000-000000000001',now()+i*interval '1 second'
 from generate_series(1,23) i;
insert into public.agentgrid_submissions(version_id,created_at)
select id,created_at from public.agentgrid_agent_versions;
create temporary table agentgrid_fixture_run(document jsonb);
insert into agentgrid_fixture_run values('{"origin":"real-host","platform_slug":"chatgpt","host_version":"Synthetic SQL fixture only","scenario":"normal","specification_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","completed_on":"2026-10-08","input":"Synthetic SQL input; not a real host run. This tests only persistence and authority boundaries.","observed_output":"Synthetic SQL output; not a real host run. This tests only persistence and authority boundaries.","assertions":[{"description":"Synthetic test assertion A; this is not production evidence.","passed":false},{"description":"Synthetic test assertion B; this is not production evidence.","passed":true}],"reviewer_notes":"Synthetic SQL review only. Never publish or treat this test record as real verification evidence."}');
grant select on agentgrid_fixture_run to authenticated;

-- Three explicitly synthetic observations; these never satisfy real launch verification.
insert into public.agentgrid_host_verification_runs(id,version_id,recorded_by,content_digest,run)
select ('40000000-0000-4000-8000-00000000000'||i)::uuid,'30000000-0000-4000-8000-000000000001',
'10000000-0000-4000-8000-000000000002',v.content_digest,f.document
from generate_series(1,3) i cross join agentgrid_fixture_run f cross join public.agentgrid_agent_versions v where v.id='30000000-0000-4000-8000-000000000001';
create temp table agentgrid_fixture_request(document jsonb);
insert into agentgrid_fixture_request select jsonb_build_object(
'requestId','50000000-0000-4000-8000-000000000001','versionId',id,'expectedDigest',content_digest,
'expectedResourceRevision',0,'expectedReleaseId',null,'evidenceIds',jsonb_build_array('40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003'),
'checks','{"standaloneValue":true,"sourceAccuracy":true,"platformEvidence":true,"privacyAndSecurity":true,"distributionAndCosts":true,"reuseRights":true}'::jsonb,
'explanation','Synthetic review intention only. This record tests authorization and state binding; no actual host verification or editorial approval is claimed.')
from public.agentgrid_agent_versions where id='30000000-0000-4000-8000-000000000001';
grant select on agentgrid_fixture_request to anon,authenticated,service_role;
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request))','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_release_requests','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request))','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request)||''{"expectedResourceRevision":1}''::jsonb)','40001');
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request)||''{"approved":true}''::jsonb)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release(jsonb_set((select document from agentgrid_fixture_request),''{checks,reuseRights}'',''false''))','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release(jsonb_set((select document from agentgrid_fixture_request),''{evidenceIds,0}'',''"40000000-0000-4000-8000-000000000099"''))','23514');
select pg_temp.agentgrid_assert(public.agentgrid_request_release((select document from agentgrid_fixture_request))->>'state'='requested','request receipt');
select public.agentgrid_request_release((select document from agentgrid_fixture_request));
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_release_requests('30000000-0000-4000-8000-000000000001')->'approvals')=1,'idempotent request');
select pg_temp.agentgrid_assert(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'state'='pending','review intent does not publish');
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request)||''{"explanation":"Different and deliberately conflicting synthetic review rationale that exceeds the minimum required length."}''::jsonb)','40001');
select pg_temp.agentgrid_expect_error('select public.agentgrid_prepare_release_request(''50000000-0000-4000-8000-000000000001'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_execute_release_request(''50000000-0000-4000-8000-000000000001'',''{}'')','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'review grants no PicMagic access');
reset role;
set local role service_role;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_prepare_release_request('50000000-0000-4000-8000-000000000001')->'observations')=3,'trusted job gets selected immutable observations');
select pg_temp.agentgrid_expect_error('select public.agentgrid_execute_release_request(''50000000-0000-4000-8000-000000000001'',''{}'')','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request))','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_publish_version(''30000000-0000-4000-8000-000000000001'',''10000000-0000-4000-8000-000000000002'',repeat(''a'',64),''{}'')','42501');
reset role;
update public.agentgrid_agents set status='blocked' where id='20000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.agentgrid_expect_error('select public.agentgrid_prepare_release_request(''50000000-0000-4000-8000-000000000001'')','42501');
reset role;
update public.agentgrid_agents set status='active' where id='20000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.agentgrid_expect_error('select public.agentgrid_prepare_release_request(''50000000-0000-4000-8000-000000000001'')','40001');
reset role;
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_cancel_release_request('50000000-0000-4000-8000-000000000001')->>'state'='cancelled','staff can cancel stale intent');
select public.agentgrid_cancel_release_request('50000000-0000-4000-8000-000000000001');
reset role;
select pg_temp.agentgrid_expect_error('update public.agentgrid_release_requests set expires_at=now()','55000');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_release_request_outcomes','55000');
-- Fresh review binds the new resource revision.
update agentgrid_fixture_request set document=document||'{"requestId":"50000000-0000-4000-8000-000000000002","expectedResourceRevision":2}'::jsonb;
set local role authenticated;
select public.agentgrid_request_release((select document from agentgrid_fixture_request));
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local role service_role;
select pg_temp.agentgrid_expect_error('select public.agentgrid_prepare_release_request(''50000000-0000-4000-8000-000000000002'')','42501');
reset role;
update public.agentgrid_profiles set status='active' where id='10000000-0000-4000-8000-000000000002';
-- Own-content reviews require administrator authority and remain labelled.
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_request_release((select document from agentgrid_fixture_request)||''{"requestId":"50000000-0000-4000-8000-000000000003"}''::jsonb)','42501');
reset role;
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','administrator');
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_request_release((select document from agentgrid_fixture_request)||'{"requestId":"50000000-0000-4000-8000-000000000003"}'::jsonb)->>'selfReview'='true','self-review is explicit and retained');
select public.agentgrid_cancel_release_request('50000000-0000-4000-8000-000000000003');
reset role;
-- A historical request cannot pass the expiry gate even with still-active staff.
insert into public.agentgrid_release_requests(id,version_id,reviewed_by,review_request,self_review,created_at,expires_at)
select '50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',document||'{"requestId":"50000000-0000-4000-8000-000000000004"}',false,now()-interval '8 days',now()-interval '1 day' from agentgrid_fixture_request;
set local role service_role;
select pg_temp.agentgrid_expect_error('select public.agentgrid_prepare_release_request(''50000000-0000-4000-8000-000000000004'')','40001');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
-- Synthetic lower-level manifest only; the real job additionally validates all observations.
create temp table agentgrid_fixture_manifest(document jsonb);
insert into agentgrid_fixture_manifest select jsonb_build_object('contract_version','0.1','content_digest',content_digest,
'editorial_passed',true,'host_checks_passed',true,'security_review_passed',true,
'specification_sha256',repeat('a',64),'editorial_sha256',repeat('b',64),
'host_run_sha256',jsonb_build_array(repeat('c',64),repeat('d',64),repeat('e',64))) from public.agentgrid_agent_versions where id='30000000-0000-4000-8000-000000000001';
grant select on agentgrid_fixture_manifest to service_role;
set local role service_role;
select pg_temp.agentgrid_assert(public.agentgrid_execute_release_request('50000000-0000-4000-8000-000000000002',(select document from agentgrid_fixture_manifest))->>'state'='released','publication bound to persisted reviewer');
select public.agentgrid_execute_release_request('50000000-0000-4000-8000-000000000002',(select document from agentgrid_fixture_manifest));
select pg_temp.agentgrid_expect_error('select public.agentgrid_execute_release_request(''50000000-0000-4000-8000-000000000002'',(select document from agentgrid_fixture_manifest)||''{"editorial_sha256":"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"}''::jsonb)','40001');
reset role;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_releases),'lost acknowledgement did not duplicate release');
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_cancel_release_request(''50000000-0000-4000-8000-000000000002'')','40001');
reset role;
rollback;
