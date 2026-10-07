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
 ('40000000-0000-4000-8000-000000000001','published','10000000-0000-4000-8000-000000000003',now());

insert into public.agentgrid_user_roles(user_id,role) values ('10000000-0000-4000-8000-000000000003','administrator');

create temp table agentgrid_report_test_ids(kind text primary key,id uuid);
grant all on agentgrid_report_test_ids to authenticated;
update public.agentgrid_profiles set visibility='public',website_url='https://example.test/creator' where id='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
insert into agentgrid_report_test_ids values
 ('agent',public.agentgrid_create_report('agent','20000000-0000-4000-8000-000000000001','privacy','Synthetic private concern about the current published agent.')),
 ('review',public.agentgrid_create_report('review','40000000-0000-4000-8000-000000000001','privacy','Synthetic private concern about the currently visible review.')),
 ('profile',public.agentgrid_create_report('profile','10000000-0000-4000-8000-000000000001','privacy','Synthetic private concern about the visible creator profile.'));
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_report_contexts),'reporter cannot access staff snapshot storage');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''open'',0)','42501');
reset role;
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''open'',0)','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_report_contexts','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-999999999999","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''open'',0)','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_staff_reports('open',0))=3,'staff queue shows actual records');
select pg_temp.agentgrid_assert(not ((public.agentgrid_staff_reports('open',0)->0) ? 'explanation'),'summary omits sensitive report prose');
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='agent'))#>>'{context,snapshot,version}'='1.0.0','published version captured');
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='review'))#>>'{context,snapshot,title}'='Synthetic byline test','public review captured');
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='profile'))#>>'{context,snapshot,website}'='https://example.test/creator','public profile captured');
select pg_temp.agentgrid_assert(not (public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='agent'))::text like '%private_evidence%'),'editorial evidence never enters report snapshot');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''open'',10000)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''invalid'',0)','23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_resolve_report((select id from agentgrid_report_test_ids where kind='agent'),'resolved','Cannot bypass involvement guard directly.')$s$,'42501');
reset role;
-- Current public content can change, while the staff evidence remains immutable.
update public.agentgrid_profiles set display_name='Changed synthetic display',website_url=null where id='10000000-0000-4000-8000-000000000001';
update public.agentgrid_reviews set title='Changed synthetic review',revision=2 where id='40000000-0000-4000-8000-000000000001';
update public.agentgrid_agents set status='blocked' where id='20000000-0000-4000-8000-000000000001';
select pg_temp.agentgrid_expect_error('update public.agentgrid_report_contexts set snapshot=''{}''','55000');
insert into public.agentgrid_user_roles(user_id,role) values ('10000000-0000-4000-8000-000000000001','moderator'),('10000000-0000-4000-8000-000000000002','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='agent'))->>'conflictOfInterest'='true','target owner involvement surfaced');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_report((select id from agentgrid_report_test_ids where kind='agent'),'dismissed','Cannot dismiss a concern about my own resource.')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_report((select id from agentgrid_report_test_ids where kind='agent'),'resolved','Cannot resolve my own submitted concern.')$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='review'))#>>'{context,snapshot,revision}'='1','original reported revision retained');
select pg_temp.agentgrid_assert(public.agentgrid_staff_report((select id from agentgrid_report_test_ids where kind='profile'))#>>'{context,snapshot,displayName}'='Fixture actor 1','original profile retained');
select pg_temp.agentgrid_assert(public.agentgrid_decide_report((select id from agentgrid_report_test_ids where kind='agent'),'resolved','Synthetic staff resolution, actual local decision only.')->>'state'='resolved','atomic live resolution');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_report((select id from agentgrid_report_test_ids where kind='agent'),'dismissed','A competing closure cannot overwrite the first.')$s$,'40001');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_moderation_actions),'one immutable decision audit');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'staff snapshot access grants no protected app access');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000003';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_staff_reports(''open'',0)','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_report_contexts),'suspended staff loses snapshot reads');
reset role;
rollback;
