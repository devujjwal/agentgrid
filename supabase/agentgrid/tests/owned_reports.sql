-- Synthetic private reports only, inside the disposable test database.
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
  raise exception 'Unexpected SQLSTATE %, expected %',sqlstate,expected;
 end;
 raise exception 'Expected SQLSTATE % was not raised',expected;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,4) i;
insert into public.agentgrid_profiles(id,username,display_name,terms_version,privacy_version)
select ('10000000-0000-4000-8000-00000000000'||i)::uuid,'report_fixture_'||i,'Report fixture '||i,'fixture-v1','fixture-v1' from generate_series(1,3) i;
insert into public.agentgrid_identities(user_id,profile_id)
select ('00000000-0000-4000-8000-00000000000'||i)::uuid,('10000000-0000-4000-8000-00000000000'||i)::uuid from generate_series(1,3) i;
insert into public.agentgrid_user_roles(user_id,role) values
 ('10000000-0000-4000-8000-000000000002','moderator'),('10000000-0000-4000-8000-000000000003','administrator');
insert into public.agentgrid_agents(id,slug,owner_id) values
 ('20000000-0000-4000-8000-000000000001','owned-report-fixture','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_agent_versions(id,agent_id,version,specification,editorial,category_slug,submitted_by)
values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','1.0.0',
 jsonb_set(current_setting('agentgrid.fixture_specification')::jsonb,'{identity,slug}','"owned-report-fixture"'),
 '{}','productivity','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_reviews(id,agent_id,author_id,used_version_id,rating,title,body,experience_note)
values ('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
 '10000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001',3,
 'Synthetic private review',repeat('Synthetic test body. ',5),repeat('Synthetic use context. ',3));
insert into public.agentgrid_reports(id,reporter_id,agent_id,review_id,profile_id,category,explanation,state,resolution,resolved_by,resolved_at,created_at)
select ('40000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',
 case when i not in (2,3) then '20000000-0000-4000-8000-000000000001'::uuid end,
 case when i=2 then '50000000-0000-4000-8000-000000000001'::uuid end,
 case when i=3 then '10000000-0000-4000-8000-000000000002'::uuid end,
 'privacy','Synthetic private reporter detail for boundary acceptance only.',
 case when i=1 then 'open' else 'resolved' end,
 case when i=1 then '' else 'Synthetic resolution for a disposable report fixture.' end,
 case when i=1 then null else '10000000-0000-4000-8000-000000000002'::uuid end,
 case when i=1 then null else now() end,now()-i*interval '1 second' from generate_series(1,22) i;
insert into public.agentgrid_reports(id,reporter_id,agent_id,category,explanation) values
 ('40000000-0000-4000-8000-000000000023','10000000-0000-4000-8000-000000000002',
 '20000000-0000-4000-8000-000000000001','privacy','Other reporter private information must remain isolated.');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports())=21,'bounded reporter history lookahead');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports(20))=2,'last history page');
select pg_temp.agentgrid_assert(public.agentgrid_owned_reports()#>>'{0,state}'='open','initial report state');
select pg_temp.agentgrid_assert(public.agentgrid_owned_reports()#>>'{1,targetKind}'='review','review target mapped');
select pg_temp.agentgrid_assert(public.agentgrid_owned_reports()#>>'{2,targetKind}'='profile','profile target mapped');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports(0,'40000000-0000-4000-8000-000000000001'))=1,'specific owned acknowledgement');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports(0,'40000000-0000-4000-8000-000000000023'))=0,'another reporter record concealed');
select pg_temp.agentgrid_assert(not (public.agentgrid_owned_reports()::text like '%Other reporter%'),'no other reporter detail');
select pg_temp.agentgrid_assert(not (public.agentgrid_owned_reports()::text like '%reporter_id%'),'no identity/role fields');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports(-1)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports(10000)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports(null)','23514');
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports(20,''40000000-0000-4000-8000-000000000001'')','23514');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports())=1,'staff reporter API remains self-only');
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports(0,'40000000-0000-4000-8000-000000000001'))=0,'staff cannot use reporter read as moderation');
select public.agentgrid_resolve_report('40000000-0000-4000-8000-000000000001','resolved','Synthetic live report resolution recorded by the moderator.');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_owned_reports(0,'40000000-0000-4000-8000-000000000001')#>>'{0,state}'='resolved','resolution immediately visible');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(jsonb_array_length(public.agentgrid_owned_reports())=0,'administrator cannot broaden reporter history');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000004","role":"authenticated","user_metadata":{"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports()','42501');
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('select public.agentgrid_owned_reports()','42501');
reset role;
select pg_temp.agentgrid_assert(not has_function_privilege('anon','public.agentgrid_owned_reports(integer,uuid)','execute'),'anonymous reports denied');
select pg_temp.agentgrid_assert(not has_function_privilege('service_role','public.agentgrid_owned_reports(integer,uuid)','execute'),'privileged reporter API denied');
rollback;
