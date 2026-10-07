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
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviewCount}'='1','actual public count');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{averageRating}'='4.00','actual aggregate');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviews,0,author,name}'='Community member','private reviewer name redacted');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>'{reviews,0,author,username}'='null'::jsonb,'private handle redacted');
select pg_temp.agentgrid_assert(not (public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')::text like '%reviewed_by%'),'no staff authority fields');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000003') is null,'private target concealed');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('99999999-0000-4000-8000-000000000001') is null,'unknown target indistinguishable');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_review(''20000000-0000-4000-8000-000000000001'')','42501');
select pg_temp.agentgrid_expect_error('select public.agentgrid_public_reviews(''20000000-0000-4000-8000-000000000001'',-1)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_public_reviews(''20000000-0000-4000-8000-000000000001'',10000)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_public_reviews(''20000000-0000-4000-8000-000000000001'',null)','23514');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_owned_review('20000000-0000-4000-8000-000000000001') is null,'staff creator endpoint remains self-only');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_owned_review('20000000-0000-4000-8000-000000000001')#>>'{state}'='published','own live review available');
select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',3::smallint,
 'Updated synthetic review',repeat('Synthetic updated review only. ',4),repeat('Synthetic experience context. ',3),1);
select pg_temp.agentgrid_assert(public.agentgrid_owned_review('20000000-0000-4000-8000-000000000001')#>>'{revision}'='2','revision advanced');
select pg_temp.agentgrid_assert(public.agentgrid_owned_review('20000000-0000-4000-8000-000000000001')#>>'{state}'='pending','editing requires new moderation');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_write_review('20000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',3::smallint,
 'Updated synthetic review',repeat('Synthetic updated review only. ',4),repeat('Synthetic experience context. ',3),1)$s$,'40001');
reset role;
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviewCount}'='0','pending review absent from count');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>'{averageRating}'='null'::jsonb,'no fabricated empty rating');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_moderate_review('40000000-0000-4000-8000-000000000001',2,'published','Synthetic moderation response after the actual local edit.');
reset role;
update public.agentgrid_profiles set visibility='public' where id='10000000-0000-4000-8000-000000000002';
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviews,0,author,username}'='fixture_actor_2','genuine opted-in contributing byline');
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviewCount}'='1','published edit visible live');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000002';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_review(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviewCount}'='0','suspended review excluded live');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-999999999999","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_review(''20000000-0000-4000-8000-000000000001'')','42501');
reset role;
update public.agentgrid_profiles set status='active' where id='10000000-0000-4000-8000-000000000002';
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'review_page_fixture_'||i,'Synthetic page fixture '||i,'fixture-v1','fixture-v1' from generate_series(4,25) i;
insert into public.agentgrid_reviews(id,agent_id,author_id,used_version_id,rating,title,body,experience_note,created_at)
select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
 ('10000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'30000000-0000-4000-8000-000000000001',5,
 'Synthetic bounded pagination',repeat('Synthetic paging feedback, not real review. ',3),repeat('Synthetic paging use context. ',3),now()-i*interval '1 second' from generate_series(4,25) i;
insert into public.agentgrid_review_moderation(review_id,state,reviewed_by,reviewed_at,reason)
select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'published','10000000-0000-4000-8000-000000000003',now(),'Synthetic page review approved only inside a disposable test.' from generate_series(4,25) i;
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')#>>'{reviewCount}'='23','aggregate counts all visible reviews');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001')->'reviews')=21,'bounded public lookahead');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001',20)->'reviews')=3,'last public page');
reset role;
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_owned_review(uuid)','execute'),'privileged key cannot use creator endpoint');
update public.agentgrid_agents set status='blocked' where id='20000000-0000-4000-8000-000000000001';
set local role anon;
select pg_temp.agentgrid_assert(public.agentgrid_public_reviews('20000000-0000-4000-8000-000000000001') is null,'blocked source has no public feedback');
reset role;
rollback;
