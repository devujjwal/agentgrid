-- Only in the disposable source database. Entirely synthetic, never real seeds.
begin;
set constraints all deferred;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version,bio,visibility) values
 ('10000000-0000-4000-8000-000000000001','fixture_creator','Synthetic creator','fixture-v1','fixture-v1','Synthetic extraction fixture, never a real creator profile.','public'),
 ('10000000-0000-4000-8000-000000000002','fixture_member','Synthetic member','fixture-v1','fixture-v1','Synthetic extraction fixture, never a real member profile.','private');
insert into public.agentgrid_identities(user_id,profile_id) values
 ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
 ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_user_roles(user_id,role,granted_by) values
 ('10000000-0000-4000-8000-000000000001','administrator','10000000-0000-4000-8000-000000000001'),
 ('10000000-0000-4000-8000-000000000002','moderator','10000000-0000-4000-8000-000000000001');
update public.agentgrid_configuration set first_party_profile_id='10000000-0000-4000-8000-000000000001',
 community_terms_version='fixture-v1',privacy_notice_version='fixture-v1';
insert into public.agentgrid_agents(id,slug,owner_id,forked_from_version_id) values
 ('20000000-0000-4000-8000-000000000001','extraction-source','10000000-0000-4000-8000-000000000001',null),
 ('20000000-0000-4000-8000-000000000002','extraction-fork','10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,editorial,category_slug,submitted_by) values
 ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'{"synthetic_editorial":"Source QA snapshot, not publishable content."}','productivity','10000000-0000-4000-8000-000000000001'),
 ('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','1.0.0',current_setting('agentgrid.fixture_specification')::jsonb,'{"synthetic_editorial":"Fork QA snapshot, not publishable content."}','productivity','10000000-0000-4000-8000-000000000002');
insert into public.agentgrid_version_platforms(version_id,platform_slug) values
 ('30000000-0000-4000-8000-000000000001','chatgpt'),('30000000-0000-4000-8000-000000000002','chatgpt');
insert into public.agentgrid_submissions(version_id,state,reviewed_by,reviewed_at) values
 ('30000000-0000-4000-8000-000000000001','approved','10000000-0000-4000-8000-000000000001',now()),
 ('30000000-0000-4000-8000-000000000002','approved','10000000-0000-4000-8000-000000000001',now());
insert into public.agentgrid_releases(agent_id,version_id,released_by,quality_manifest) values
 ('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','{"synthetic_qa":true}'),
 ('20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','{"synthetic_qa":true}');
insert into public.agentgrid_drafts(agent_id,specification,editorial,revision) values
 ('20000000-0000-4000-8000-000000000002',current_setting('agentgrid.fixture_specification')::jsonb,'{"private_note":"Synthetic private draft for extraction fidelity."}',4);
insert into public.agentgrid_favorites(profile_id,agent_id) values('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001');
insert into public.agentgrid_rate_limits(user_id,action,window_started_at,count) values('10000000-0000-4000-8000-000000000002','favorite',now(),3);
insert into public.agentgrid_reviews(id,agent_id,author_id,used_version_id,rating,title,body,experience_note) values
 ('40000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002',
 '30000000-0000-4000-8000-000000000001',4,'Synthetic extraction review',repeat('Synthetic review for database migration testing only. ',3),repeat('No real user or usage claim is represented. ',2));
insert into public.agentgrid_review_moderation(review_id,state,reason,reviewed_by,reviewed_at) values
 ('40000000-0000-4000-8000-000000000001','published','Synthetic review-state extraction test.','10000000-0000-4000-8000-000000000001',now());
insert into public.agentgrid_reports(id,reporter_id,agent_id,category,explanation) values
 ('50000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
 'privacy','Synthetic confidential report retained only in an isolated QA database.');
insert into public.agentgrid_moderation_actions(actor_id,action,review_id,explanation) values
 ('10000000-0000-4000-8000-000000000001','published-review','40000000-0000-4000-8000-000000000001','Synthetic extraction action, not a real moderation claim.');
insert into public.agentgrid_host_verification_runs(id,version_id,recorded_by,content_digest,run) select '60000000-0000-4000-8000-000000000001',id,'10000000-0000-4000-8000-000000000002',content_digest,'{"synthetic_extraction_only":"Not host evidence: verifies owned-data migration fidelity."}' from public.agentgrid_agent_versions where id='30000000-0000-4000-8000-000000000001';
insert into public.agentgrid_release_requests(id,version_id,reviewed_by,review_request,self_review) values('70000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','{"synthetic_extraction_only":true}',false);
insert into public.agentgrid_release_request_outcomes(request_id,outcome,actor_id) values('70000000-0000-4000-8000-000000000001','cancelled','10000000-0000-4000-8000-000000000002');

create function pg_temp.agentgrid_assert(condition boolean, explanation text) returns void
language plpgsql as $$ begin if condition is distinct from true then raise exception 'Assertion failed: %',explanation; end if; end $$;
create temp table agentgrid_capture_fixture as select
 public.agentgrid_publication_index(null) as initial_index,
 public.agentgrid_public_delivery_state('fixture-original') as original_state;
-- Use actual fixture slugs, never production content.
update agentgrid_capture_fixture set original_state=public.agentgrid_public_delivery_state((select slug from public.agentgrid_agents where id='20000000-0000-4000-8000-000000000001'));
grant select on agentgrid_capture_fixture to anon,authenticated;
set local role service_role;
select pg_temp.agentgrid_assert(public.agentgrid_analytics_record('{"event":"agent_view","resourceId":"20000000-0000-4000-8000-000000000001","versionId":"30000000-0000-4000-8000-000000000001"}'),'live published version accepts aggregate view');
select pg_temp.agentgrid_assert(public.agentgrid_analytics_record('{"event":"copy_instructions","resourceId":"20000000-0000-4000-8000-000000000001","versionId":"30000000-0000-4000-8000-000000000001","platform":"chatgpt"}'),'declared platform accepts copy observation');
select pg_temp.agentgrid_assert(not public.agentgrid_analytics_record('{"event":"copy_instructions","resourceId":"20000000-0000-4000-8000-000000000001","versionId":"30000000-0000-4000-8000-000000000001","platform":"invented"}'),'unsupported platform measurement denied');
select pg_temp.agentgrid_assert(not public.agentgrid_analytics_record('{"event":"agent_view","resourceId":"20000000-0000-4000-8000-000000000001","versionId":"30000000-0000-4000-8000-000000000002"}'),'wrong version measurement denied');
reset role;
set local role anon;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_publication_index(null)->'items')=2,'only publicly released rows are exported');
select pg_temp.agentgrid_assert(public.agentgrid_publication_index('ffffffff-ffff-4fff-8fff-ffffffffffff')->'items'='[]'::jsonb,'cursor past final resource is bounded and empty');
select pg_temp.agentgrid_assert(not has_table_privilege('anon','public.agentgrid_publication_state','select'),'raw publication state is private');
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_publication_index(uuid)','execute'),'capture uses public authority only');
select pg_temp.agentgrid_assert(public.agentgrid_public_delivery_state('unknown-private-slug') is null,'unknown and unavailable resources share null response');
reset role;
update public.agentgrid_profiles set bio='Changed synthetic public author biography for snapshot race testing.' where id='10000000-0000-4000-8000-000000000001';
select pg_temp.agentgrid_assert((public.agentgrid_publication_index(null)->>'revision')::bigint>(select (initial_index->>'revision')::bigint from agentgrid_capture_fixture),'creator changes advance consistency fence');
select pg_temp.agentgrid_assert(public.agentgrid_public_delivery_state((select original_state->>'slug' from agentgrid_capture_fixture))->>'tag' is distinct from (select original_state->>'tag' from agentgrid_capture_fixture),'changed public creator data changes delivery tag');
update public.agentgrid_agents set status='blocked' where id='20000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.agentgrid_assert(not public.agentgrid_analytics_record('{"event":"agent_view","resourceId":"20000000-0000-4000-8000-000000000001","versionId":"30000000-0000-4000-8000-000000000001"}'),'withdrawn version measurement denied');
reset role;
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_delivery_state((select original_state->>'slug' from agentgrid_capture_fixture)) is null,'takedown becomes unavailable immediately');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_publication_index(null)->'items')=1,'blocked content is excluded from fresh capture');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'capture grants no protected data access');
reset role;
-- Private working-draft saves do not churn the public capture fence.
update agentgrid_capture_fixture set initial_index=public.agentgrid_publication_index(null);
update public.agentgrid_drafts set editorial='{"private_note":"Updated synthetic private draft; never export."}' where agent_id='20000000-0000-4000-8000-000000000002';
select pg_temp.agentgrid_assert(public.agentgrid_publication_index(null)->>'revision'=(select initial_index->>'revision' from agentgrid_capture_fixture),'private drafts do not invalidate public content');
rollback;
