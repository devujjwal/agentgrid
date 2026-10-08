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
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_submissions(''pending'',0)','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_submission(''30000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_submissions(''pending'',0)','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_submissions('pending',0))=21,'bounded staff lookahead');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_submissions('pending',20))=3,'staff pagination');
select pg_temp.agentgrid_assert(not(public.agentgrid_staff_submissions('pending',0)::text like '%submitted_context%'),'queue omits private body');
select pg_temp.agentgrid_assert(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'editorialText' like '%submitted_context%','detail includes exact submitted editorial');
select pg_temp.agentgrid_assert(not(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')::text like '%private_working_draft%'),'staff projection never reads current draft');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'staff gains no protected app access');
select pg_temp.agentgrid_expect_error('select public.agentgrid_decide_submission(''30000000-0000-4000-8000-000000000001'',''rejected'',''Legacy rejection must be refused.'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_reject_submission(''30000000-0000-4000-8000-000000000001'',repeat(''0'',64),''Wrong immutable version digest must be refused.'')','40001');
select pg_temp.agentgrid_assert(public.agentgrid_reject_submission('30000000-0000-4000-8000-000000000001',
 (public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000001')->>'contentDigest'),'Synthetic review: clarify the setup and provide the missing source context.')->>'state'='rejected','exact rejection receipt');
select pg_temp.agentgrid_expect_error('select public.agentgrid_reject_submission(''30000000-0000-4000-8000-000000000001'',(public.agentgrid_staff_submission(''30000000-0000-4000-8000-000000000001'')->>''contentDigest''),''Repeated rejection cannot overwrite the first decision.'')','40001');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_moderation_actions where action='rejected-version'),'immutable audit recorded once');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_submissions(''pending'',0)','42501');
reset role;
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000002')->>'authorIsSelf'='true','staff owns source flag');
select pg_temp.agentgrid_expect_error('select public.agentgrid_reject_submission(''30000000-0000-4000-8000-000000000002'',(public.agentgrid_staff_submission(''30000000-0000-4000-8000-000000000002'')->>''contentDigest''),''Self rejection requires an uninvolved moderator.'')','42501');
select public.agentgrid_decide_submission('30000000-0000-4000-8000-000000000002','withdrawn','Owner withdrawal remains a separate valid operation.');
select pg_temp.agentgrid_assert(public.agentgrid_staff_submission('30000000-0000-4000-8000-000000000002')->>'state'='withdrawn','withdrawal remains supported');
reset role;
rollback;
