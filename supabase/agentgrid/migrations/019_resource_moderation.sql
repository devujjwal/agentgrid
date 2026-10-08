-- AgentGrid-only status revision; shared application resources remain untouched.
alter table public.agentgrid_agents
 add column moderation_revision integer not null default 0 check(moderation_revision>=0),
 add column moderation_reason text not null default '' check(char_length(moderation_reason)<=2400),
 add column moderated_at timestamptz;
create function public.agentgrid_advance_resource_status()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$ begin
 if new.status is distinct from old.status then new.moderation_revision:=old.moderation_revision+1; end if;
 return new;
end; $agentgrid_function$;
create trigger agentgrid_resource_status_revision before update on public.agentgrid_agents
for each row execute function public.agentgrid_advance_resource_status();
alter table public.agentgrid_rate_limits drop constraint agentgrid_rate_limits_action_check;
alter table public.agentgrid_rate_limits add constraint agentgrid_rate_limits_action_check
 check(action in ('create_agent','save_draft','submit','review','report','favorite','fork','profile','moderate-review','moderate-report','moderate-submission','moderate-resource'));
create function public.agentgrid_staff_resource(resource_id uuid)
returns jsonb language plpgsql stable security definer set search_path=''
as $agentgrid_function$
declare result jsonb;
begin
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 select pg_catalog.jsonb_build_object('resourceId',a.id,'slug',a.slug,'status',a.status,
 'revision',a.moderation_revision,'reason',a.moderation_reason,'moderatedAt',a.moderated_at,
 'ownerIsSelf',a.owner_id=public.agentgrid_profile_id(),'ownerStatus',p.status,
 'releasedVersionId',r.version_id,'releasedVersion',v.version)
 into result from public.agentgrid_agents a join public.agentgrid_profiles p on p.id=a.owner_id
 left join public.agentgrid_releases r on r.agent_id=a.id
 left join public.agentgrid_agent_versions v on v.id=r.version_id where a.id=resource_id;
 return result;
end; $agentgrid_function$;
create function public.agentgrid_decide_resource(resource_id uuid,expected_revision integer,expected_release_id uuid,decision text,explanation text)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
declare resource public.agentgrid_agents%rowtype; release_id uuid;
begin
 -- Same lock order as role changes, suspension and account deactivation.
 perform 1 from public.agentgrid_configuration where singleton for update;
 if not public.agentgrid_has_role(array['moderator','administrator']) then raise exception 'Staff required' using errcode='42501'; end if;
 perform public.agentgrid_enforce_quota('moderate-resource',120,3600);
 if decision is null or decision not in ('active','blocked') or explanation is null
 or char_length(btrim(explanation)) not between 20 and 2400 then raise exception 'Clear decision required' using errcode='23514'; end if;
 select * into resource from public.agentgrid_agents where id=resource_id for update;
 if not found or resource.owner_id=public.agentgrid_profile_id() or resource.status='archived' then
 raise exception 'Uninvolved staff and available resource required' using errcode='42501'; end if;
 select version_id into release_id from public.agentgrid_releases where agent_id=resource_id;
 if expected_revision is distinct from resource.moderation_revision or expected_release_id is distinct from release_id
 or resource.status=decision then raise exception 'Resource changed; reload' using errcode='40001'; end if;
 if decision='active' and not exists(select 1 from public.agentgrid_profiles where id=resource.owner_id and status='active') then
 raise exception 'Active owner required for restoration' using errcode='42501'; end if;
 update public.agentgrid_agents set status=decision,moderation_reason=btrim(explanation),moderated_at=pg_catalog.now() where id=resource_id;
 insert into public.agentgrid_moderation_actions(actor_id,action,agent_id,explanation)
 values(public.agentgrid_profile_id(),case when decision='blocked' then 'blocked-agent' else 'restored-agent' end,resource_id,btrim(explanation));
 return public.agentgrid_staff_resource(resource_id);
end; $agentgrid_function$;
-- Close the legacy mutation bypass; historical function stays for migration continuity.
revoke all on function public.agentgrid_moderate_agent(uuid,boolean,text),
 public.agentgrid_advance_resource_status(),public.agentgrid_staff_resource(uuid),
 public.agentgrid_decide_resource(uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_staff_resource(uuid),
 public.agentgrid_decide_resource(uuid,integer,uuid,text,text) to authenticated;
-- Existing row visibility must not make newly added investigation notes public.
-- Staff read those fields only through the bounded, freshly authorized RPC.
revoke select on public.agentgrid_agents from anon,authenticated;
grant select(id,slug,owner_id,forked_from_version_id,status,created_at,moderation_revision)
 on public.agentgrid_agents to anon,authenticated;
