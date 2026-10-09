-- Synthetic admission checks; the entire transaction is discarded.
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
insert into public.agentgrid_onboarding_pilots(user_id,expires_at)
values('00000000-0000-4000-8000-000000000001',now()+interval '1 day');
insert into public.agentgrid_onboarding_pilots(user_id,created_at,expires_at)
values('00000000-0000-4000-8000-000000000003',now()-interval '2 days',now()-interval '1 day');
select pg_temp.agentgrid_expect_error($s$insert into public.agentgrid_onboarding_pilots(user_id,expires_at)
 values('00000000-0000-4000-8000-000000000004',now()+interval '15 days')$s$,'23514');

set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()#>>'{onboarding,enabled}'='false','pilot alone cannot bypass missing legal versions');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('pilot_owner','Pilot owner',null,null)$s$,'42501');
reset role;
update public.agentgrid_configuration set community_terms_version='fixture-v1',privacy_notice_version='fixture-v1';

-- Neither default grants, the service role nor app moderation can enroll users.
do $test$
declare actor text; privilege text;
begin
 foreach actor in array array['anon','authenticated','service_role'] loop
  foreach privilege in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
   if has_table_privilege(actor,'public.agentgrid_onboarding_pilots',privilege) then
    raise exception 'Pilot table exposed to % via %',actor,privilege;
   end if;
  end loop;
  if has_function_privilege(actor,'public.agentgrid_can_create_profile()','EXECUTE') then
   raise exception 'Internal eligibility helper exposed to %',actor;
  end if;
 end loop;
end $test$;
set local role anon;
select pg_temp.agentgrid_expect_error('select public.agentgrid_workspace_identity()','42501');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('anonymous','Anonymous','fixture-v1','fixture-v1')$s$,'42501');
reset role;
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()#>>'{onboarding,enabled}'='true','current pilot sees consent form');
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()->'profile'='null'::jsonb,'pilot does not manufacture membership');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('pilot_owner','Pilot owner','old-version','fixture-v1')$s$,'42501');
select public.agentgrid_create_profile('pilot_owner','Pilot owner','fixture-v1','fixture-v1');
select pg_temp.agentgrid_assert(public.agentgrid_is_member() and not public.agentgrid_has_role(array['moderator','administrator']),'explicit consent creates only ordinary membership');
select pg_temp.agentgrid_assert((select visibility='private' from public.agentgrid_profiles),'new profile stays private');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('second_owner','Second owner','fixture-v1','fixture-v1')$s$,'23505');
select pg_temp.agentgrid_expect_error('select public.picmagic_admin_only_fixture()','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.picmagic_private_fixture),'pilot gains no protected application access');
reset role;

-- Direct RPC bypass of the Worker still cannot admit an unlisted managed user.
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"pilot":true,"role":"administrator"}}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()#>>'{onboarding,enabled}'='false','metadata cannot enroll a shared identity');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('other_user','Other user','fixture-v1','fixture-v1')$s$,'42501');
select pg_temp.agentgrid_expect_error('select * from public.agentgrid_onboarding_pilots','42501');
select pg_temp.agentgrid_assert((select count(*)=0 from public.agentgrid_profiles),'different user cannot read pilot private profile');
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000003","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()#>>'{onboarding,enabled}'='false','expired pilot is denied without a cleanup job');
select pg_temp.agentgrid_expect_error($s$select public.agentgrid_create_profile('expired_user','Expired user','fixture-v1','fixture-v1')$s$,'42501');
reset role;

-- Moderators and administrators do not acquire admission-configuration rights.
insert into public.agentgrid_user_roles(user_id,role)
select profile_id,role from public.agentgrid_identities cross join unnest(array['moderator','administrator']) role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
select pg_temp.agentgrid_expect_error('delete from public.agentgrid_onboarding_pilots','42501');
select pg_temp.agentgrid_expect_error('update public.agentgrid_configuration set profile_creation_enabled=true','42501');
reset role;
delete from public.agentgrid_onboarding_pilots where user_id='00000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.agentgrid_assert(public.agentgrid_workspace_identity()#>>'{onboarding,enabled}'='false','revocation is immediately visible');
select pg_temp.agentgrid_assert(public.agentgrid_is_member(),'admission expiry never deletes existing membership');
reset role;

-- Later public registration uses the same consent and private-membership contract.
update public.agentgrid_configuration set profile_creation_enabled=true;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated"}';
set local role authenticated;
select public.agentgrid_create_profile('public_member','Public member','fixture-v1','fixture-v1');
select pg_temp.agentgrid_assert(public.agentgrid_is_member(),'global admission remains compatible');
reset role;
delete from auth.users where id='00000000-0000-4000-8000-000000000003';
select pg_temp.agentgrid_assert(not exists(select 1 from public.agentgrid_onboarding_pilots where user_id='00000000-0000-4000-8000-000000000003'),'managed identity deletion removes only its owned pilot link');
rollback;
