-- AgentGrid-only revision-bound administrator decisions. Shared Auth is untouched.
alter table public.agentgrid_profiles add column governance_revision integer not null default 1 check(governance_revision>0);
create function public.agentgrid_advance_profile_revision()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$ begin
 new.governance_revision:=old.governance_revision+1;
 return new;
end; $agentgrid_function$;
create trigger agentgrid_profiles_governance_revision before update on public.agentgrid_profiles
for each row execute function public.agentgrid_advance_profile_revision();

create function public.agentgrid_role_profile_revision()
returns trigger language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if tg_op<>'INSERT' then
  update public.agentgrid_profiles set governance_revision=governance_revision where id=old.user_id;
 end if;
 if tg_op='INSERT' or (tg_op='UPDATE' and new.user_id is distinct from old.user_id) then
  update public.agentgrid_profiles set governance_revision=governance_revision where id=new.user_id;
 end if;
 return null;
end; $agentgrid_function$;
create trigger agentgrid_roles_profile_revision after insert or update or delete on public.agentgrid_user_roles
for each row execute function public.agentgrid_role_profile_revision();

create function public.agentgrid_profile_governance_snapshot(target_profile_id uuid)
returns jsonb language sql volatile security definer set search_path=''
as $agentgrid_function$
 select pg_catalog.jsonb_build_object('id',p.id,'username',p.username,'displayName',p.display_name,
  'bio',p.bio,'website',p.website_url,'visibility',p.visibility,'status',p.status,
  'revision',p.governance_revision,'isSelf',p.id=public.agentgrid_profile_id(),
  'linked',exists(select 1 from public.agentgrid_identities i where i.profile_id=p.id),
  'roles',coalesce((select pg_catalog.jsonb_agg(r.role order by r.role) from public.agentgrid_user_roles r where r.user_id=p.id),'[]'::jsonb))
 from public.agentgrid_profiles p where p.id=target_profile_id;
$agentgrid_function$;

create function public.agentgrid_admin_profile(requested_username text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if not public.agentgrid_has_role(array['administrator']) then raise exception 'Administrator required' using errcode='42501'; end if;
 if requested_username is null or requested_username!~'^[a-z][a-z0-9_]{2,29}$' then
  raise exception 'Exact username required' using errcode='23514'; end if;
 return public.agentgrid_profile_governance_snapshot((select id from public.agentgrid_profiles where username=requested_username));
end; $agentgrid_function$;

create function public.agentgrid_decide_profile(target_profile_id uuid,expected_revision integer,decision text,decision_reason text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare target public.agentgrid_profiles%rowtype; requested_role text; granting boolean;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['administrator']) then raise exception 'Administrator required' using errcode='42501'; end if;
 if decision is null or decision not in ('suspend','restore','grant-moderator','revoke-moderator','grant-administrator','revoke-administrator')
  or decision_reason is null or char_length(btrim(decision_reason)) not between 20 and 2360 then
  raise exception 'Explicit profile decision required' using errcode='23514'; end if;
 select * into target from public.agentgrid_profiles where id=target_profile_id for update;
 if not found or target.status='deactivated' or not exists(select 1 from public.agentgrid_identities where profile_id=target_profile_id) then
  raise exception 'Linked profile required' using errcode='42501'; end if;
 if expected_revision is null or target.governance_revision<>expected_revision then
  raise exception 'Profile changed; review current state' using errcode='40001'; end if;
 if decision in ('suspend','restore') then
  if (decision='suspend' and target.status<>'active') or (decision='restore' and target.status<>'suspended') then
   raise exception 'Decision does not change current state' using errcode='23514'; end if;
  perform public.agentgrid_moderate_profile(target_profile_id,decision='suspend',decision_reason);
 else
  requested_role:=pg_catalog.split_part(decision,'-',2); granting:=decision like 'grant-%';
  if granting=exists(select 1 from public.agentgrid_user_roles where user_id=target_profile_id and role=requested_role) then
   raise exception 'Decision does not change current role' using errcode='23514'; end if;
  perform public.agentgrid_change_role(target_profile_id,requested_role,granting,decision_reason);
 end if;
 return public.agentgrid_profile_governance_snapshot(target_profile_id);
end; $agentgrid_function$;

revoke all on function public.agentgrid_advance_profile_revision(),public.agentgrid_role_profile_revision(),
 public.agentgrid_profile_governance_snapshot(uuid),public.agentgrid_admin_profile(text),
 public.agentgrid_decide_profile(uuid,integer,text,text),
 public.agentgrid_change_role(uuid,text,boolean,text),public.agentgrid_moderate_profile(uuid,boolean,text)
from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_admin_profile(text),public.agentgrid_decide_profile(uuid,integer,text,text) to authenticated;
