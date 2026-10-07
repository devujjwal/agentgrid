begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002');
insert into public.agentgrid_profiles(id,username,display_name,bio,terms_version,privacy_version)
values('10000000-0000-4000-8000-000000000001','fixture_owner','Fixture owner','Self-only biography','fixture-v1','fixture-v1');
insert into public.agentgrid_identities(user_id,profile_id) values('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001');
insert into public.agentgrid_user_roles(user_id,role) values('10000000-0000-4000-8000-000000000001','moderator');
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
do $test$
declare value jsonb:=public.agentgrid_workspace_identity();
begin
 if value#>>'{profile,bio}' is distinct from 'Self-only biography' or value#>>'{roles,0}' is distinct from 'moderator' then
  raise exception 'Own profile/current role unavailable'; end if;
 if value#>>'{onboarding,enabled}' is distinct from 'false' then raise exception 'Onboarding gate fabricated'; end if;
 if value::text like '%00000000-0000-4000-8000-000000000001%' then raise exception 'Managed identity leaked'; end if;
end $test$;
reset role;
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"administrator"}}';
set local role authenticated;
do $test$
declare value jsonb:=public.agentgrid_workspace_identity();
begin
 if value->'profile' is distinct from 'null'::jsonb or value->'roles' is distinct from '[]'::jsonb then
  raise exception 'Other application identity gained membership/private profile'; end if;
end $test$;
reset role;
update public.agentgrid_profiles set status='suspended' where id='10000000-0000-4000-8000-000000000001';
set local request.jwt.claims='{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}';
set local role authenticated;
do $test$
begin
 if public.agentgrid_workspace_identity()->'roles' is distinct from '[]'::jsonb then raise exception 'Suspended role retained in live workspace'; end if;
end $test$;
reset role;
do $test$
begin
 if has_function_privilege('anon','public.agentgrid_workspace_identity()','execute') or
  has_function_privilege('service_role','public.agentgrid_workspace_identity()','execute') then
  raise exception 'Self-only workspace exposed to privileged/public role'; end if;
end $test$;
rollback;
