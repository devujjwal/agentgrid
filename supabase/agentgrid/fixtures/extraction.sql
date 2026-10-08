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
commit;
