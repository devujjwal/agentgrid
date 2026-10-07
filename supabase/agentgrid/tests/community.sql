-- Local synthetic records only, rolled back. These are never application seeds.
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
create temp table agentgrid_fixture_state(key text primary key,id uuid);
grant all on agentgrid_fixture_state to anon,authenticated,service_role;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,6) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000' || i)::uuid,'fixture_actor_'||i,'Fixture actor '||i,'fixture-v1','fixture-v1' from generate_series(1,5) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000' || i)::uuid,('10000000-0000-4000-8000-00000000000' || i)::uuid from generate_series(1,5) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000003','moderator'),('10000000-0000-4000-8000-000000000004','administrator');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000005';
update public.agentgrid_profiles set visibility='public' where id='10000000-0000-4000-8000-000000000001';
insert into public.agentgrid_agents(id,slug,owner_id)
select ('20000000-0000-4000-8000-00000000000'||i)::uuid,'fixture-resource-'||i,
 '10000000-0000-4000-8000-000000000001' from generate_series(1,3) i;
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,category_slug,submitted_by)
select ('30000000-0000-4000-8000-00000000000'||i)::uuid,('20000000-0000-4000-8000-00000000000'||i)::uuid,
 '1.0.0',jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}',to_jsonb('fixture-resource-'||i)),
 'productivity','10000000-0000-4000-8000-000000000001' from generate_series(1,3) i;
insert into public.agentgrid_submissions(version_id,state,reviewed_by,reviewed_at)
select ('30000000-0000-4000-8000-00000000000'||i)::uuid,'approved',
 '10000000-0000-4000-8000-000000000003',now() from generate_series(1,2) i;
insert into public.agentgrid_submissions(version_id) values('30000000-0000-4000-8000-000000000003');
insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest)
select ('20000000-0000-4000-8000-00000000000'||i)::uuid,('30000000-0000-4000-8000-00000000000'||i)::uuid,
 '10000000-0000-4000-8000-000000000003','{}' from generate_series(1,2) i;

set local role anon;
select pg_temp.agentgrid_assert((select review_count=0 and average_rating is null from public.agentgrid_public_rating('20000000-0000-4000-8000-000000000001')),'no reviews means no invented rating');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_public_creator('fixture_actor_1')),'public creator has real published contribution');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_profiles','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_favorites','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_reports','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_review_moderation','42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_moderation_actions','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true)$s$,'42501');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',5::smallint,'Own agent review',repeat('Own agent reviews are prohibited. ',4),repeat('Synthetic usage claim only. ',3))$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true);
select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true);
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_favorites),'save retry is idempotent');
select public.agentgrid_set_profile_visibility(true);
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_public_creator('fixture_actor_2')),'empty creator profiles are not publicly projected');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002',5::smallint,'Wrong package review',repeat('Synthetic mismatched version review. ',4),repeat('Synthetic usage claim only. ',3))$s$,'42501');
insert into agentgrid_fixture_state values('review',public.agentgrid_write_review(
 '20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',5::smallint,
 'Synthetic review title',repeat('Synthetic review text for database acceptance only. ',4),repeat('Synthetic usage context, not an actual user review. ',2)));
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_review_moderation where state='pending'),'reviews start pending');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',5::smallint,'Duplicate review title',repeat('Duplicate initial write must conflict. ',4),repeat('Synthetic usage context only. ',3))$s$,'40001');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_review((select id from agentgrid_fixture_state where key='review'),1,0,'published','Unauthorized publication attempt')$s$,'42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_report('agent','20000000-0000-4000-8000-000000000003','privacy',repeat('Private target must not be exposed by reporting. ',2))$s$,'42501');
reset role;
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reviews),'pending reviews remain private');
select pg_temp.agentgrid_assert((select review_count=0 and average_rating is null from public.agentgrid_public_rating('20000000-0000-4000-8000-000000000001')),'pending reviews do not create a rating');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_favorites),'creators cannot read another member''s saved list');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reviews),'creator cannot read an unapproved review by another member');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_favorites),'staff status does not expose other saved lists');
select public.agentgrid_decide_review((select id from agentgrid_fixture_state where key='review'),1,0,'published','Synthetic moderation acceptance only.');
reset role;
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_reviews),'approved review is readable');
select pg_temp.agentgrid_assert((select review_count=1 and average_rating=5 from public.agentgrid_public_rating('20000000-0000-4000-8000-000000000001')),'only an actual approved record contributes to the aggregate');
reset role;

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
insert into agentgrid_fixture_state values('report',public.agentgrid_create_report('review',
 (select id from agentgrid_fixture_state where key='review'),'privacy',repeat('Synthetic confidential reporting details. ',3)));
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_report('review',(select id from agentgrid_fixture_state where key='review'),'privacy',repeat('Duplicate open report must not spam staff. ',3))$s$,'23505');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_resolve_report((select id from agentgrid_fixture_state where key='report'),'resolved','Unauthorized resolution attempt')$s$,'42501');
select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',4::smallint,
 'Synthetic updated review',repeat('Edited text needs moderation again before public display. ',3),repeat('Synthetic usage context only. ',3),1);
reset role;
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reviews),'editing removes prior public approval immediately');
select pg_temp.agentgrid_assert((select review_count=0 from public.agentgrid_public_rating('20000000-0000-4000-8000-000000000001')),'edited pending review does not retain an old aggregate');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reports),'target creator cannot read confidential reports');
select pg_temp.agentgrid_expect_error('update public.agentgrid_review_moderation set state=''published''','42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_decide_review((select id from agentgrid_fixture_state where key='review'),1,0,'published','Moderation of a stale revision')$s$,'40001');
select public.agentgrid_decide_review((select id from agentgrid_fixture_state where key='review'),2,1,'published','Synthetic updated revision reviewed.');
select public.agentgrid_resolve_report((select id from agentgrid_fixture_state where key='report'),'resolved','Synthetic reporting acceptance resolution.');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_resolve_report((select id from agentgrid_fixture_state where key='report'),'resolved','Duplicate resolution cannot overwrite history')$s$,'40001');
select public.agentgrid_moderate_agent('20000000-0000-4000-8000-000000000001',true,'Synthetic takedown acceptance only.');
reset role;
set local role anon;
select pg_temp.agentgrid_assert(not public.agentgrid_is_public_agent('20000000-0000-4000-8000-000000000001'),'blocked resource is unavailable live');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reviews),'blocked resource reviews are not public');
select pg_temp.agentgrid_assert((select review_count=0 and average_rating is null from public.agentgrid_public_rating('20000000-0000-4000-8000-000000000001')),'blocked resource has no public aggregate');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',false);
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_favorites),'blocked resource can still be unsaved');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true)$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_moderate_agent('20000000-0000-4000-8000-000000000001',false,'Synthetic restoration acceptance only.');
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_moderation_actions','42501');
reset role;
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_moderation_actions','55000');
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reviews),'suspended author review is hidden');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000005","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true)$s$,'42501');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000006","role":"authenticated","app_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_set_favorite('20000000-0000-4000-8000-000000000001',true)$s$,'42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_reports),'shared non-member sees no confidential reports');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'community operation grants no protected app access');
reset role;
rollback;
