-- Serialize AgentGrid-controlled staff changes on its own configuration row.
-- External managed Auth deletion must never be blocked by a last-admin check.
create function public.agentgrid_change_role(target_profile_id uuid,requested_role text,grant_role boolean,decision_reason text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['administrator']) then raise exception 'Administrator required' using errcode='42501'; end if;
 if requested_role is null or requested_role not in ('moderator','administrator') or grant_role is null
   or decision_reason is null or char_length(btrim(decision_reason)) not between 20 and 2360 then
   raise exception 'An explicit role decision is required' using errcode='23514';
 end if;
 if not exists(select 1 from public.agentgrid_profiles p join public.agentgrid_identities i on i.profile_id=p.id
   where p.id=target_profile_id and p.status='active') then raise exception 'Active AgentGrid member required' using errcode='42501'; end if;
 if not grant_role and requested_role='administrator'
   and exists(select 1 from public.agentgrid_user_roles where user_id=target_profile_id and role='administrator')
   and not exists(select 1 from public.agentgrid_user_roles r join public.agentgrid_profiles p on p.id=r.user_id
   where r.role='administrator' and p.status='active' and p.id<>target_profile_id) then
   raise exception 'Another active administrator is required' using errcode='42501';
 end if;
 if grant_role then
   insert into public.agentgrid_user_roles(user_id,role,granted_by)
   values(target_profile_id,requested_role,public.agentgrid_profile_id()) on conflict do nothing;
 else
   delete from public.agentgrid_user_roles where user_id=target_profile_id and role=requested_role;
 end if;
 if found then
   insert into public.agentgrid_moderation_actions(actor_id,action,profile_id,explanation)
   values(public.agentgrid_profile_id(),case when grant_role then 'granted-role' else 'revoked-role' end,target_profile_id,
   requested_role||': '||decision_reason);
 end if;
end; $agentgrid_function$;

create function public.agentgrid_moderate_profile(target_profile_id uuid,suspended boolean,decision_reason text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['administrator']) then raise exception 'Administrator required' using errcode='42501'; end if;
 if suspended is null or decision_reason is null or char_length(btrim(decision_reason)) not between 20 and 2400 then
   raise exception 'A clear profile decision is required' using errcode='23514'; end if;
 if not exists(select 1 from public.agentgrid_identities where profile_id=target_profile_id) then
   raise exception 'Detached accounts cannot be restored' using errcode='42501'; end if;
 if suspended and exists(select 1 from public.agentgrid_user_roles where user_id=target_profile_id and role='administrator')
   and not exists(select 1 from public.agentgrid_user_roles r join public.agentgrid_profiles p on p.id=r.user_id
   where r.role='administrator' and p.status='active' and p.id<>target_profile_id) then
   raise exception 'Another active administrator is required' using errcode='42501'; end if;
 update public.agentgrid_profiles set status=case when suspended then 'suspended' else 'active' end
 where id=target_profile_id and status<>'deactivated';
 if not found then raise exception 'Profile unavailable' using errcode='42501'; end if;
 insert into public.agentgrid_moderation_actions(actor_id,action,profile_id,explanation)
 values(public.agentgrid_profile_id(),case when suspended then 'suspended-profile' else 'restored-profile' end,target_profile_id,decision_reason);
end; $agentgrid_function$;

-- Explicit AgentGrid-only account removal. Shared auth.users and other apps are
-- untouched. Immutable/resource/security records need a separate retention and
-- erasure runbook; this is not a promise to erase every historical artifact.
create function public.agentgrid_deactivate_account(confirmed_username text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare actor uuid:=public.agentgrid_profile_id(); profile public.agentgrid_profiles%rowtype;
begin
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_is_member() then raise exception 'Active account required' using errcode='42501'; end if;
 select * into profile from public.agentgrid_profiles where id=actor for update;
 if confirmed_username is distinct from profile.username then raise exception 'Confirm the current username' using errcode='23514'; end if;
 if public.agentgrid_has_role(array['administrator'])
   and not exists(select 1 from public.agentgrid_user_roles r join public.agentgrid_profiles p on p.id=r.user_id
   where r.role='administrator' and p.status='active' and p.id<>actor) then
   raise exception 'Another active administrator is required' using errcode='42501'; end if;
 -- Account and draft/review operations all lock this profile first. No global
 -- sign-out, managed-user delete, protected table mutation or app-wide trigger.
 update public.agentgrid_agents set status='archived' where owner_id=actor;
 delete from public.agentgrid_drafts d using public.agentgrid_agents a where d.agent_id=a.id and a.owner_id=actor;
 delete from public.agentgrid_favorites where profile_id=actor;
 update public.agentgrid_submissions s set state='withdrawn',reason='Account deactivated by its owner.',reviewed_by=actor,reviewed_at=pg_catalog.now()
 from public.agentgrid_agent_versions v where s.version_id=v.id and v.submitted_by=actor and s.state='pending';
 update public.agentgrid_review_moderation m set state='hidden',reason='Account deactivated by its owner.',reviewed_by=actor,reviewed_at=pg_catalog.now()
 from public.agentgrid_reviews r where r.id=m.review_id and r.author_id=actor;
 insert into public.agentgrid_moderation_actions(actor_id,action,profile_id,explanation)
 values(actor,'deactivated-account',actor,'AgentGrid account deactivated by its verified owner.');
 -- The owned detach trigger clears public profile information and stable IDs
 -- preserve attribution/audit FKs. A later signup gets a new business profile.
 delete from public.agentgrid_identities where profile_id=actor and user_id=auth.uid();
end; $agentgrid_function$;

revoke all on function public.agentgrid_change_role(uuid,text,boolean,text),
 public.agentgrid_moderate_profile(uuid,boolean,text),public.agentgrid_deactivate_account(text)
from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_change_role(uuid,text,boolean,text),
 public.agentgrid_moderate_profile(uuid,boolean,text),public.agentgrid_deactivate_account(text) to authenticated;
