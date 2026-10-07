-- Synthetic review projection fixtures only; no real publication, account or feedback.
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
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','fixture-source','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,category_slug,submitted_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'productivity','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agents(id,slug,owner_id,forked_from_version_id) values
 ('20000000-0000-4000-8000-000000000002','fixture-fork','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001'),
 ('20000000-0000-4000-8000-000000000003','fixture-private','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,category_slug,submitted_by) values
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'productivity','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_submissions(version_id,state,reviewed_by,reviewed_at)
select ('30000000-0000-4000-8000-00000000000'||i)::uuid,'approved','10000000-0000-4000-8000-000000000003',now() from generate_series(1,2) i;
insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest)
select ('20000000-0000-4000-8000-00000000000'||i)::uuid,('30000000-0000-4000-8000-00000000000'||i)::uuid,
 '10000000-0000-4000-8000-000000000003','{"private_evidence":"Synthetic staff-only notes"}' from generate_series(1,2) i;
insert into public.agentgrid_reviews(id,agent_id,author_id,used_version_id,rating,title,body,experience_note) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
 '30000000-0000-4000-8000-000000000001',4,'Synthetic byline test',repeat('Synthetic review, never real feedback. ',4),repeat('Synthetic usage context only. ',3));
insert into public.agentgrid_review_moderation(review_id,state,reviewed_by,reviewed_at) values
 ('40000000-0000-4000-8000-000000000001','pending',null,null);

insert into public.agentgrid_user_roles(user_id,role) values ('10000000-0000-4000-8000-000000000003','administrator');

set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(''pending'',0)','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_review(''40000000-0000-4000-8000-000000000001'')','42501');
reset role;
-- Shared Auth membership/metadata never appoints AgentGrid staff.
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-999999999999","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(''pending'',0)','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_review(''40000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_reviews('pending',0))=1,'actual pending queue');
select pg_temp.agentgrid_assert(not ((public.agentgrid_staff_reviews('pending',0)->0) ? 'body'),'queue omits full private content');
select pg_temp.agentgrid_assert(public.agentgrid_staff_review('40000000-0000-4000-8000-000000000001')->>'authorIsSelf'='false','staff attribution guard');
select pg_temp.agentgrid_assert(not (public.agentgrid_staff_review('40000000-0000-4000-8000-000000000001') ? 'author_id'),'no private identity projection');
select pg_temp.agentgrid_assert(public.agentgrid_staff_review('99999999-0000-4000-8000-000000000001') is null,'unknown review absent');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(''withdrawn'',0)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(''pending'',10000)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(null,0)','23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_moderate_review('40000000-0000-4000-8000-000000000001',1,'published','Direct legacy call cannot bypass concurrency')$s$,'42501');
select pg_temp.agentgrid_assert(public.agentgrid_decide_review('40000000-0000-4000-8000-000000000001',1,0,'published','Synthetic staff acceptance; no real feedback.') ->>'decisionRevision'='1','decision and acknowledgement atomic');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_review('40000000-0000-4000-8000-000000000001',1,0,'hidden','Competing moderator must reload first.')$s$,'40001');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_moderation_actions),'stale decision writes no audit');
select pg_temp.agentgrid_assert(public.agentgrid_decide_review('40000000-0000-4000-8000-000000000001',1,1,'hidden','Synthetic privacy concern confirmed locally.') ->>'state'='hidden','fresh decision accepted');
reset role;
-- Authors cannot moderate their own feedback, even after a legitimate staff appointment.
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000002','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_review('40000000-0000-4000-8000-000000000001')->>'authorIsSelf'='true','self marker visible');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_review('40000000-0000-4000-8000-000000000001',1,2,'published','Cannot approve my own synthetic review.')$s$,'42501');
select public.agentgrid_withdraw_review('20000000-0000-4000-8000-000000000001',1);
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_reviews('hidden',0))=0,'withdrawn reviews leave actionable queue');
select pg_temp.agentgrid_assert(public.agentgrid_staff_review('40000000-0000-4000-8000-000000000001')->>'state'='withdrawn','withdrawn detail recoverable');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_review('40000000-0000-4000-8000-000000000001',2,2,'published','Cannot override the author withdrawal.')$s$,'42501');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reviews(''pending'',0)','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'staff appointment grants no protected application access');
reset role;
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_decide_review(uuid,integer,integer,text,text)','execute'),'service credential not staff authority');
rollback;
