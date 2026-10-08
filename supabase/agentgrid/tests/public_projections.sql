-- Synthetic projection fixtures only; never real release, review or host evidence.
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

set local role anon;
select pg_temp.agentgrid_assert((select creator_kind='first-party' and creator_name='AgentGrid Editorial'
 from public.agentgrid_public_resource('fixture-source')),'first-party attribution requires the configured real profile');
select pg_temp.agentgrid_assert((select creator_kind='community' and creator_name='Community creator' and creator_username is null
 from public.agentgrid_public_resource('fixture-fork')),'private creator profile fields do not become a public byline');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_public_resource('fixture-private')),'working private agent has no public projection');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_public_lineage('20000000-0000-4000-8000-000000000003')),'private fork lineage is not public');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_public_lineage('20000000-0000-4000-8000-000000000002')),'public fork has exact source-version lineage');
select pg_temp.agentgrid_assert((select not (to_jsonb(resource) ? 'quality_manifest') from public.agentgrid_public_resource('fixture-fork') resource),'public shape excludes private quality evidence');
select pg_temp.agentgrid_assert((select display_name='Community member' and username is null from public.agentgrid_public_review_byline('40000000-0000-4000-8000-000000000001')),'review byline respects private profile visibility');
reset role;
select pg_temp.agentgrid_expect_error($s$update public.agentgrid_agents set forked_from_version_id=null where slug='fixture-fork'$s$,'55000');
update public.agentgrid_profiles set visibility='public' where id='10000000-0000-4000-8000-000000000002';
set local role anon;
select pg_temp.agentgrid_assert((select creator_username='fixture_actor_2' from public.agentgrid_public_resource('fixture-fork')),'opted-in creator byline links to a genuine contributing profile');
select pg_temp.agentgrid_assert((select username='fixture_actor_2' from public.agentgrid_public_review_byline('40000000-0000-4000-8000-000000000001')),'public contributing reviewer may link their profile');
select pg_temp.agentgrid_assert(public.agentgrid_public_creator_page('fixture_actor_1',0) is null,'private first-party profile is hidden');
select pg_temp.agentgrid_assert(public.agentgrid_public_creator_page('fixture_actor_3',0) is null,'non-contributing profile is hidden');
select pg_temp.agentgrid_assert(public.agentgrid_public_creator_page('fixture_actor_2',0)->>'username'='fixture_actor_2','public contributing creator is live');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_public_creator_page('fixture_actor_2',0)->'agents')=1,'only released public agents appear');
select pg_temp.agentgrid_assert(not (public.agentgrid_public_creator_page('fixture_actor_2',0) ? 'user_id'),'public creator excludes shared identity');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_public_creator_page('fixture_actor_2',20)->'agents')=0,'pagination is bounded');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_public_creator_page('fixture_actor_2',1)$s$,'23514');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_public_creator_page('fixture_actor_2',10000)$s$,'23514');
reset role;
update public.agentgrid_profiles set bio='Changed live biography',website_url='https://example.test/' where username='fixture_actor_2';
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_creator_page('fixture_actor_2',0)->>'bio'='Changed live biography','profile changes do not wait for static publication');
reset role;
update public.agentgrid_profiles set status='suspended' where username='fixture_actor_2';
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_creator_page('fixture_actor_2',0) is null,'suspension immediately hides creator');
reset role;
update public.agentgrid_profiles set status='active' where username='fixture_actor_2';
set local role anon;
reset role;
update public.agentgrid_agents set status='blocked' where slug='fixture-source';
set local role anon;
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_public_resource('fixture-source')),'blocked source projection is removed');
select pg_temp.agentgrid_assert((select count(*)=1 from public.agentgrid_public_resource('fixture-fork')),'licensed fork availability is independent of source availability');
select pg_temp.agentgrid_assert((select not source_available and source_version='1.0.0' from public.agentgrid_public_lineage('20000000-0000-4000-8000-000000000002')),'blocked source retains minimal attribution but no instructions');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_agent_versions where agent_id='20000000-0000-4000-8000-000000000001'),'blocked source content stays hidden');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_public_review_byline('40000000-0000-4000-8000-000000000001')),'unavailable review has no public byline');
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.agentgrid_assert((select creator_name='Deleted creator' from public.agentgrid_public_lineage('20000000-0000-4000-8000-000000000002')),'shared deletion preserves source attribution with deidentified creator');
reset role;
rollback;
