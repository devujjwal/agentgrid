-- Private execution ledger. Only the verified server adapter may operate it.
create table public.agentgrid_execution_policy (
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false,
 limit_micros bigint not null default 0 check(limit_micros>=0),
 held_micros bigint not null default 0 check(held_micros>=0),
 spent_micros bigint not null default 0 check(spent_micros>=0),
 check(held_micros+spent_micros<=limit_micros)
);
insert into public.agentgrid_execution_policy(singleton) values(true);
create table public.agentgrid_execution_budgets (
 profile_id uuid primary key references public.agentgrid_profiles(id) deferrable initially immediate,
 limit_micros bigint not null default 0 check(limit_micros>=0),
 held_micros bigint not null default 0 check(held_micros>=0),
 spent_micros bigint not null default 0 check(spent_micros>=0),
 attempt_day date not null default current_date,
 attempts integer not null default 0 check(attempts>=0),
 check(held_micros+spent_micros<=limit_micros)
);
create table public.agentgrid_execution_packages (
 version_id uuid primary key references public.agentgrid_agent_versions(id) deferrable initially immediate,
 enabled boolean not null default false
);
create table public.agentgrid_execution_runs (
 id uuid primary key, owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 idempotency_key uuid not null, version_id uuid not null references public.agentgrid_agent_versions(id) deferrable initially immediate,
 provider_identity text not null check(length(provider_identity) between 1 and 120),
 instructions text not null check(length(instructions)<=24000),
 input text not null check(length(input) between 1 and 12000),
 digest text not null check(digest ~ '^[a-f0-9]{64}$'),
 maximum_cost_micros bigint not null check(maximum_cost_micros between 1 and 250000),
 state text not null default 'queued' check(state in ('queued','running','succeeded','cancelled','uncertain','blocked')),
 approved boolean not null default false, reserved boolean not null default false,
 output text check(length(output)<=32000),
 created_at timestamptz not null default now(), started_at timestamptz, approved_at timestamptz,
 billed_micros bigint check(billed_micros between 0 and maximum_cost_micros),
 unique(owner_id,idempotency_key)
);
create table public.agentgrid_execution_events (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.agentgrid_execution_runs(id) deferrable initially immediate,
 kind text not null check(kind in ('reserved','settled','uncertain','cancelled')),
 amount_micros bigint check(amount_micros>=0),recorded_at timestamptz not null default now()
);
alter table public.agentgrid_execution_events enable row level security;
revoke all on public.agentgrid_execution_events from public,anon,authenticated,service_role;
create index agentgrid_execution_owner_recent on public.agentgrid_execution_runs(owner_id,created_at desc);
alter table public.agentgrid_execution_policy enable row level security;
alter table public.agentgrid_execution_budgets enable row level security;
alter table public.agentgrid_execution_packages enable row level security;
alter table public.agentgrid_execution_runs enable row level security;
revoke all on public.agentgrid_execution_policy,public.agentgrid_execution_budgets,public.agentgrid_execution_packages,public.agentgrid_execution_runs from public,anon,authenticated,service_role;

create function public.agentgrid_execution_record(r public.agentgrid_execution_runs)
returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',r.id,'ownerId',r.owner_id,'idempotencyKey',r.idempotency_key,
 'versionId',r.version_id,'providerIdentity',r.provider_identity,'instructions',r.instructions,
 'input',r.input,'digest',r.digest,'maximumCostMicros',r.maximum_cost_micros,'approved',r.approved,'state',r.state,'output',r.output);
$$;
revoke all on function public.agentgrid_execution_record(public.agentgrid_execution_runs) from public,anon,authenticated,service_role;

create function public.agentgrid_server_execution(actor_user_id uuid,operation text,evidence jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.agentgrid_execution_runs; policy public.agentgrid_execution_policy;
 budget public.agentgrid_execution_budgets; resource uuid; cost bigint; result jsonb;
begin
 if operation is null or operation not in ('overview','source','prepare','read','approve','claim','finish','cancel')
 or evidence is null or jsonb_typeof(evidence)<>'object' or octet_length(evidence::text)>250000 then
 raise exception 'Invalid execution operation' using errcode='23514'; end if;
 select p.id into actor from public.agentgrid_identities i join public.agentgrid_profiles p on p.id=i.profile_id
 where i.user_id=actor_user_id and p.status='active';
 if actor is null then raise exception 'Active member required' using errcode='42501'; end if;
 -- Every operation follows the same lock order, including cancellation/settlement.
 select * into policy from public.agentgrid_execution_policy where singleton for update;
 if not found then raise exception 'Execution policy unavailable' using errcode='42501'; end if;
 insert into public.agentgrid_execution_budgets(profile_id) values(actor) on conflict do nothing;
 select * into budget from public.agentgrid_execution_budgets where profile_id=actor for update;
 -- A lost worker must never cause an automatic second provider dispatch.
 update public.agentgrid_execution_runs set state='uncertain'
 where owner_id=actor and state='running' and started_at<now()-interval '2 minutes';
 if operation='overview' then
 -- Erase aged completed content while retaining the minimal cost ledger.
 update public.agentgrid_execution_runs set input='[Expired]',instructions='',output=null
 where owner_id=actor and not reserved and state in ('succeeded','cancelled','blocked') and created_at<now()-interval '30 days';
 return jsonb_build_object('enabled',policy.enabled,'agents',coalesce((select jsonb_agg(x) from
 (select v.id as "versionId",left(v.specification->'identity'->>'name',100) as name
 from public.agentgrid_execution_packages e join public.agentgrid_agent_versions v on v.id=e.version_id
 where e.enabled and public.agentgrid_is_public_version(v.id) limit 50) x),'[]'::jsonb),
 'runs',coalesce((select jsonb_agg(public.agentgrid_execution_record(x)) from
 (select * from public.agentgrid_execution_runs where owner_id=actor order by created_at desc limit 20) x),'[]'::jsonb),
 'budget',jsonb_build_object('limitMicros',budget.limit_micros,'heldMicros',budget.held_micros,'spentMicros',budget.spent_micros));
 end if;
 if operation='source' then
 resource:=(evidence->>'versionId')::uuid;
 select jsonb_build_object('versionId',v.id,'published',true,'executionApproved',true,'specification',v.specification)
 into result from public.agentgrid_agent_versions v join public.agentgrid_execution_packages e on e.version_id=v.id
 where v.id=resource and e.enabled and public.agentgrid_is_public_version(v.id);
 if result is null then raise exception 'Package unavailable' using errcode='42501'; end if;
 return result;
 end if;
 if operation='prepare' then
 if not policy.enabled or (evidence->>'ownerId') is distinct from actor::text then raise exception 'Execution unavailable' using errcode='42501'; end if;
 resource:=(evidence->>'versionId')::uuid;
 if not exists(select 1 from public.agentgrid_execution_packages where version_id=resource and enabled)
 or not public.agentgrid_is_public_version(resource) then raise exception 'Package unavailable' using errcode='42501'; end if;
 select * into r from public.agentgrid_execution_runs where owner_id=actor and idempotency_key=(evidence->>'idempotencyKey')::uuid;
 if found then return public.agentgrid_execution_record(r); end if;
 if (select count(*) from public.agentgrid_execution_runs where owner_id=actor and created_at>now()-interval '1 day')>=20 then
 raise exception 'Daily preparation limit reached' using errcode='23514'; end if;
 insert into public.agentgrid_execution_runs(id,owner_id,idempotency_key,version_id,provider_identity,instructions,input,digest,maximum_cost_micros)
 values((evidence->>'id')::uuid,actor,(evidence->>'idempotencyKey')::uuid,resource,evidence->>'providerIdentity',evidence->>'instructions',evidence->>'input',evidence->>'digest',(evidence->>'maximumCostMicros')::bigint) returning * into r;
 return public.agentgrid_execution_record(r);
 end if;
 select * into r from public.agentgrid_execution_runs where id=(evidence->>'id')::uuid and owner_id=actor for update;
 if not found then return 'null'::jsonb; end if;
 if operation='read' then return public.agentgrid_execution_record(r); end if;
 if operation='approve' then
 if not policy.enabled or r.digest is distinct from (evidence->>'digest') or r.state<>'queued' then raise exception 'Approval mismatch' using errcode='23514'; end if;
 update public.agentgrid_execution_runs set approved=true,approved_at=now() where id=r.id returning * into r;
 return public.agentgrid_execution_record(r);
 end if;
 if operation='claim' then
 if not policy.enabled or not r.approved or r.approved_at<now()-interval '15 minutes' or r.state<>'queued' or r.digest is distinct from (evidence->>'digest')
 or not public.agentgrid_is_public_version(r.version_id)
 or not exists(select 1 from public.agentgrid_execution_packages where version_id=r.version_id and enabled)
 then return 'false'::jsonb; end if;
 if budget.attempt_day<>(now() at time zone 'UTC')::date then budget.attempts:=0; end if;
 if budget.attempts>=5 or budget.held_micros>0
 or budget.limit_micros-budget.held_micros-budget.spent_micros<r.maximum_cost_micros
 or policy.limit_micros-policy.held_micros-policy.spent_micros<r.maximum_cost_micros then
 update public.agentgrid_execution_runs set state='blocked' where id=r.id;
 return 'false'::jsonb; end if;
 update public.agentgrid_execution_policy set held_micros=held_micros+r.maximum_cost_micros where singleton;
 update public.agentgrid_execution_budgets set held_micros=held_micros+r.maximum_cost_micros,
 attempts=budget.attempts+1,attempt_day=(now() at time zone 'UTC')::date where profile_id=actor;
 update public.agentgrid_execution_runs set state='running',reserved=true,started_at=now() where id=r.id;
 insert into public.agentgrid_execution_events(run_id,kind,amount_micros) values(r.id,'reserved',r.maximum_cost_micros);
 return 'true'::jsonb;
 end if;
 if operation='cancel' then
 if r.state in ('queued','running','uncertain') then insert into public.agentgrid_execution_events(run_id,kind) values(r.id,'cancelled'); end if;
 update public.agentgrid_execution_runs set state='cancelled',output=null where id=r.id and state in ('queued','running','uncertain');
 select * into r from public.agentgrid_execution_runs where id=r.id;
 return public.agentgrid_execution_record(r);
 end if;
 if operation='finish' and r.reserved and r.state in ('running','cancelled','uncertain') then
 if evidence->>'state'='succeeded' then
 cost:=(evidence->>'billedMicros')::bigint;
 if cost is null or cost<0 or cost>r.maximum_cost_micros then raise exception 'Invalid settlement' using errcode='23514'; end if;
 update public.agentgrid_execution_policy set held_micros=held_micros-r.maximum_cost_micros,spent_micros=spent_micros+cost where singleton;
 update public.agentgrid_execution_budgets set held_micros=held_micros-r.maximum_cost_micros,spent_micros=spent_micros+cost where profile_id=actor;
 insert into public.agentgrid_execution_events(run_id,kind,amount_micros) values(r.id,'settled',cost);
 update public.agentgrid_execution_runs set reserved=false,billed_micros=cost,state=case when state='cancelled' then state else 'succeeded' end,
 output=case when state='cancelled' then null else evidence->>'output' end where id=r.id;
 elsif evidence->>'state'='uncertain' then
 if r.state='running' then insert into public.agentgrid_execution_events(run_id,kind) values(r.id,'uncertain'); end if;
 update public.agentgrid_execution_runs set state=case when state='cancelled' then state else 'uncertain' end,output=null where id=r.id;
 else raise exception 'Invalid finish' using errcode='23514'; end if;
 end if;
 return 'null'::jsonb;
end; $$;
revoke all on function public.agentgrid_server_execution(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_server_execution(uuid,text,jsonb) to service_role;
