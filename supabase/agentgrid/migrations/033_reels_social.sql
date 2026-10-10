-- Disabled reel/social control plane. No credentials or provider calls in migration.
create table public.agentgrid_media_policy (
 singleton boolean primary key default true check(singleton),
 render_enabled boolean not null default false, publish_enabled boolean not null default false
);
insert into public.agentgrid_media_policy(singleton) values(true);
create table public.agentgrid_reels (
 id uuid primary key, owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 source_run_id uuid not null references public.agentgrid_execution_runs(id) deferrable initially immediate,
 idempotency_key uuid not null, snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<=100000),
 digest text not null check(digest ~ '^[a-f0-9]{64}$'), maximum_cost_micros bigint not null check(maximum_cost_micros between 1 and 5000000),
 state text not null default 'queued' check(state in ('queued','rendering','ready','cancelled','uncertain','blocked')),
 approved_at timestamptz, reserved boolean not null default false, task_id text check(length(task_id) between 1 and 200),
 started_at timestamptz, billed_micros bigint check(billed_micros between 0 and maximum_cost_micros), created_at timestamptz not null default now(),
 unique(owner_id,idempotency_key)
);
create table public.agentgrid_media_assets (
 id uuid primary key, owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 reel_id uuid not null unique references public.agentgrid_reels(id) deferrable initially immediate,
 metadata jsonb not null check(jsonb_typeof(metadata)='object' and octet_length(metadata::text)<2000)
);
create table public.agentgrid_social_connections (
 id uuid primary key, owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 platform text not null check(platform in ('instagram','facebook','linkedin')),
 provider_account_id text not null check(length(provider_account_id) between 1 and 300),
 publishing_enabled boolean not null default false, expires_at timestamptz not null,
 -- AEAD blob bound to owner + connection + platform; never a plaintext bearer token.
 sealed_tokens text not null check(sealed_tokens ~ '^v1\.[a-f0-9]{24}\.[a-f0-9]+$' and length(sealed_tokens)<=100000)
);
create table public.agentgrid_social_publications (
 id uuid primary key, owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 reel_id uuid not null references public.agentgrid_reels(id) deferrable initially immediate,
 media_id uuid not null references public.agentgrid_media_assets(id) deferrable initially immediate,
 preview jsonb not null check(jsonb_typeof(preview)='object' and octet_length(preview::text)<=50000),
 digest text not null check(digest ~ '^[a-f0-9]{64}$'), scheduled_at timestamptz not null,
 approved_at timestamptz, expires_at timestamptz,
 -- A single immutable preview cannot be prepared twice and produce duplicate posts.
 unique(owner_id,digest)
);
create table public.agentgrid_social_deliveries (
 id uuid primary key default gen_random_uuid(),
 publication_id uuid not null references public.agentgrid_social_publications(id) deferrable initially immediate,
 connection_id uuid not null references public.agentgrid_social_connections(id) deferrable initially immediate,
 state text not null default 'pending' check(state in ('pending','dispatching','published','uncertain','cancelled')),
 started_at timestamptz, provider_post_id text check(length(provider_post_id) between 1 and 300),
 unique(publication_id,connection_id)
);
create index agentgrid_reels_owner_recent on public.agentgrid_reels(owner_id,created_at desc);
alter table public.agentgrid_media_policy enable row level security;
alter table public.agentgrid_reels enable row level security;
alter table public.agentgrid_media_assets enable row level security;
alter table public.agentgrid_social_connections enable row level security;
alter table public.agentgrid_social_publications enable row level security;
alter table public.agentgrid_social_deliveries enable row level security;
revoke all on public.agentgrid_media_policy,public.agentgrid_reels,public.agentgrid_media_assets,
 public.agentgrid_social_connections,public.agentgrid_social_publications,public.agentgrid_social_deliveries
 from public,anon,authenticated,service_role;

create function public.agentgrid_reel_record(r public.agentgrid_reels)
returns jsonb language sql stable set search_path='' as $$
 select r.snapshot || jsonb_build_object('state',r.state,'taskId',r.task_id,'asset',
 (select metadata from public.agentgrid_media_assets where reel_id=r.id));
$$;
revoke all on function public.agentgrid_reel_record(public.agentgrid_reels) from public,anon,authenticated,service_role;

create function public.agentgrid_server_media(actor_user_id uuid,operation text,evidence jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; r public.agentgrid_reels; policy public.agentgrid_media_policy; execution public.agentgrid_execution_policy;
 budget public.agentgrid_execution_budgets; asset public.agentgrid_media_assets; publication public.agentgrid_social_publications;
 delivery public.agentgrid_social_deliveries; connection public.agentgrid_social_connections; destination jsonb; cost bigint; result jsonb;
begin
 if operation is null or operation not in ('prepare','read','approve','claim','task','finish','cancel','publication','approve-publication','read-delivery','context','claim-delivery','finish-delivery','submitted-delivery','disconnect')
 or evidence is null or jsonb_typeof(evidence)<>'object' or octet_length(evidence::text)>150000 then
 raise exception 'Invalid media operation' using errcode='23514'; end if;
 select p.id into actor from public.agentgrid_identities i join public.agentgrid_profiles p on p.id=i.profile_id
 where i.user_id=actor_user_id and p.status='active';
 if actor is null then raise exception 'Active member required' using errcode='42501'; end if;
 -- Shared lock order with text execution: site budget before member before jobs.
 select * into execution from public.agentgrid_execution_policy where singleton for update;
 if not found then raise exception 'Execution policy unavailable' using errcode='42501'; end if;
 select * into policy from public.agentgrid_media_policy where singleton for update;
 if not found then raise exception 'Media policy unavailable' using errcode='42501'; end if;
 insert into public.agentgrid_execution_budgets(profile_id) values(actor) on conflict do nothing;
 select * into budget from public.agentgrid_execution_budgets where profile_id=actor for update;
 if operation='disconnect' then
 update public.agentgrid_social_connections set publishing_enabled=false, sealed_tokens='v1.000000000000000000000000.00'
 where id=(evidence->>'id')::uuid and owner_id=actor;
 update public.agentgrid_social_deliveries d set state='cancelled' from public.agentgrid_social_publications p
 where p.id=d.publication_id and p.owner_id=actor and d.connection_id=(evidence->>'id')::uuid and d.state='pending';
 return 'null'::jsonb;
 end if;
 if operation='prepare' then
 if not execution.enabled or not policy.render_enabled or evidence->>'ownerId' is distinct from actor::text then
 raise exception 'Rendering unavailable' using errcode='42501'; end if;
 select * into r from public.agentgrid_reels where owner_id=actor and idempotency_key=(evidence->>'idempotencyKey')::uuid;
 if found then return public.agentgrid_reel_record(r); end if;
 if not exists(select 1 from public.agentgrid_execution_runs where id=(evidence->'plan'->>'sourceRunId')::uuid and owner_id=actor and state='succeeded') then
 raise exception 'Private source unavailable' using errcode='42501'; end if;
 if (select count(*) from public.agentgrid_reels where owner_id=actor and created_at>now()-interval '1 day')>=10 then
 raise exception 'Preparation limit reached' using errcode='23514'; end if;
 insert into public.agentgrid_reels(id,owner_id,source_run_id,idempotency_key,snapshot,digest,maximum_cost_micros)
 values((evidence->>'id')::uuid,actor,(evidence->'plan'->>'sourceRunId')::uuid,(evidence->>'idempotencyKey')::uuid,
 evidence-'state'-'taskId'-'asset',evidence->>'digest',(evidence->>'maximumCostMicros')::bigint) returning * into r;
 return public.agentgrid_reel_record(r);
 end if;
 if operation in ('read','approve','claim','task','finish','cancel') then
 select * into r from public.agentgrid_reels where id=(evidence->>'id')::uuid and owner_id=actor for update;
 if not found then return 'null'::jsonb; end if;
 if operation='read' then
 if r.state='rendering' and r.task_id is null and r.started_at<now()-interval '2 minutes' then
 update public.agentgrid_reels set state='uncertain' where id=r.id returning * into r; end if;
 return public.agentgrid_reel_record(r); end if;
 if operation='approve' then
 if not execution.enabled or not policy.render_enabled or r.state<>'queued' or r.digest is distinct from (evidence->>'digest') then
 raise exception 'Approval mismatch' using errcode='23514'; end if;
 update public.agentgrid_reels set approved_at=now() where id=r.id;
 return public.agentgrid_reel_record(r);
 end if;
 if operation='claim' then
 if not execution.enabled or not policy.render_enabled or r.state<>'queued' or r.approved_at is null
 or r.approved_at<now()-interval '15 minutes' or r.digest is distinct from (evidence->>'digest') then return 'false'::jsonb; end if;
 if budget.attempt_day<>(now() at time zone 'UTC')::date then budget.attempts:=0; end if;
 if budget.attempts>=5 or budget.held_micros>0 or budget.limit_micros-budget.held_micros-budget.spent_micros<r.maximum_cost_micros
 or execution.limit_micros-execution.held_micros-execution.spent_micros<r.maximum_cost_micros then
 update public.agentgrid_reels set state='blocked' where id=r.id; return 'false'::jsonb; end if;
 update public.agentgrid_execution_policy set held_micros=held_micros+r.maximum_cost_micros where singleton;
 update public.agentgrid_execution_budgets set held_micros=held_micros+r.maximum_cost_micros,
 attempts=budget.attempts+1,attempt_day=(now() at time zone 'UTC')::date where profile_id=actor;
 update public.agentgrid_reels set reserved=true,state='rendering',started_at=now() where id=r.id;
 return 'true'::jsonb;
 end if;
 if operation='task' then
 if evidence->>'taskId' is null or not r.reserved or r.state<>'rendering' or (r.task_id is not null and r.task_id is distinct from evidence->>'taskId') then
 raise exception 'Task mismatch' using errcode='23514'; end if;
 update public.agentgrid_reels set task_id=evidence->>'taskId' where id=r.id;
 return 'null'::jsonb;
 end if;
 if operation='cancel' then
 update public.agentgrid_reels set state='cancelled' where id=r.id and state in ('queued','rendering','uncertain');
 return 'null'::jsonb;
 end if;
 if operation='finish' and r.reserved and r.state in ('rendering','cancelled','uncertain') then
 if evidence->'asset' is null or evidence->'asset'='null'::jsonb then
 update public.agentgrid_reels set state=case when state='cancelled' then state else 'uncertain' end where id=r.id;
 return 'null'::jsonb; end if;
 cost:=(evidence->>'billedMicros')::bigint;
 if cost is null or cost<0 or cost>r.maximum_cost_micros then raise exception 'Invalid settlement' using errcode='23514'; end if;
 if evidence->'asset'->>'contentType' is distinct from 'video/mp4'
 or evidence->'asset'->>'width' is distinct from '720' or evidence->'asset'->>'height' is distinct from '1280'
 or jsonb_typeof(evidence->'asset'->'bytes') is distinct from 'number'
 or (evidence->'asset'->>'bytes')::bigint not between 12 and 50000000
 or jsonb_typeof(evidence->'asset'->'seconds') is distinct from 'number'
 or (evidence->'asset'->>'seconds')::numeric<=0 or (evidence->'asset'->>'seconds')::numeric>30 then
 raise exception 'Invalid video manifest' using errcode='23514'; end if;
 if evidence->'asset'->>'ownerId' is distinct from actor::text or evidence->'asset'->>'runId' is distinct from r.id::text
 or evidence->'asset'->>'sha256' is null or evidence->'asset'->>'sha256' !~ '^[a-f0-9]{64}$'
 or evidence->'asset'->>'key' is distinct from ('owners/'||actor||'/reels/'||r.id||'/'||(evidence->'asset'->>'id')||'.mp4') then
 raise exception 'Invalid media ownership' using errcode='23514'; end if;
 update public.agentgrid_execution_policy set held_micros=held_micros-r.maximum_cost_micros,spent_micros=spent_micros+cost where singleton;
 update public.agentgrid_execution_budgets set held_micros=held_micros-r.maximum_cost_micros,spent_micros=spent_micros+cost where profile_id=actor;
 if r.state<>'cancelled' then
 insert into public.agentgrid_media_assets(id,owner_id,reel_id,metadata) values((evidence->'asset'->>'id')::uuid,actor,r.id,evidence->'asset'); end if;
 update public.agentgrid_reels set reserved=false,billed_micros=cost,state=case when state='cancelled' then state else 'ready' end where id=r.id;
 end if;
 return 'null'::jsonb;
 end if;
 if operation='publication' then
 if not execution.enabled or not policy.publish_enabled then raise exception 'Publishing unavailable' using errcode='42501'; end if;
 select * into asset from public.agentgrid_media_assets where id=(evidence->'preview'->>'mediaId')::uuid and owner_id=actor;
 if not found or asset.reel_id::text is distinct from evidence->'preview'->>'runId'
 or asset.metadata->>'sha256' is distinct from evidence->'preview'->>'mediaSha256' then
 raise exception 'Media unavailable' using errcode='42501'; end if;
 if jsonb_typeof(evidence->'preview'->'destinations') is distinct from 'array'
 or jsonb_array_length(evidence->'preview'->'destinations') not between 1 and 3 then raise exception 'Invalid destinations' using errcode='23514'; end if;
 -- Validate every destination before preparing any delivery. Owner-scoped digest is idempotent.
 for destination in select * from jsonb_array_elements(evidence->'preview'->'destinations') loop
 select * into connection from public.agentgrid_social_connections where id=(destination->>'connectionId')::uuid and owner_id=actor;
 if not found or not connection.publishing_enabled or connection.expires_at<=now() or connection.platform is distinct from destination->>'platform'
 or length(destination->>'caption') not between 1 and 3000 or destination->>'caption' is null then
 raise exception 'Connection unavailable' using errcode='42501'; end if;
 end loop;
 insert into public.agentgrid_social_publications(id,owner_id,reel_id,media_id,preview,digest,scheduled_at)
 values((evidence->>'id')::uuid,actor,asset.reel_id,asset.id,evidence->'preview',evidence->>'digest',(evidence->'preview'->>'scheduledAt')::timestamptz)
 on conflict(owner_id,digest) do nothing;
 select * into publication from public.agentgrid_social_publications where owner_id=actor and digest=evidence->>'digest';
 for destination in select * from jsonb_array_elements(publication.preview->'destinations') loop
 insert into public.agentgrid_social_deliveries(publication_id,connection_id) values(publication.id,(destination->>'connectionId')::uuid) on conflict do nothing;
 end loop;
 return to_jsonb(publication.id);
 end if;
 if operation='approve-publication' then
 select * into publication from public.agentgrid_social_publications where id=(evidence->>'id')::uuid and owner_id=actor for update;
 if not found or not execution.enabled or not policy.publish_enabled or publication.digest is distinct from evidence->>'digest'
 or publication.scheduled_at>now()+interval '24 hours' or publication.scheduled_at<now()-interval '15 minutes'
 or exists(select 1 from public.agentgrid_social_deliveries where publication_id=publication.id and state<>'pending') then
 raise exception 'Approval mismatch' using errcode='23514'; end if;
 update public.agentgrid_social_publications set approved_at=now(),expires_at=now()+interval '24 hours' where id=publication.id;
 return 'null'::jsonb;
 end if;
 select d.* into delivery from public.agentgrid_social_deliveries d join public.agentgrid_social_publications p on p.id=d.publication_id
 where d.id=(evidence->>'id')::uuid and p.owner_id=actor for update of d;
 if not found then return 'null'::jsonb; end if;
 select * into publication from public.agentgrid_social_publications where id=delivery.publication_id;
 select * into connection from public.agentgrid_social_connections where id=delivery.connection_id;
 select * into asset from public.agentgrid_media_assets where id=publication.media_id;
 if delivery.state='dispatching' and delivery.started_at<now()-interval '2 minutes' then
 update public.agentgrid_social_deliveries set state='uncertain' where id=delivery.id; delivery.state:='uncertain'; end if;
 if operation='read-delivery' then return jsonb_build_object('id',delivery.id,'ownerId',actor,'preview',publication.preview,
 'digest',publication.digest,'connectionId',delivery.connection_id,'state',delivery.state,'providerPostId',delivery.provider_post_id); end if;
 if operation='context' then return jsonb_build_object('asset',asset.metadata,'approval',case when publication.approved_at is null then null else
 jsonb_build_object('ownerId',actor,'digest',publication.digest,'expiresAt',publication.expires_at) end,
 'connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'ownerId',c.owner_id,'platform',c.platform,
 'publishingEnabled',c.publishing_enabled and c.expires_at>now())) from public.agentgrid_social_connections c
 where c.owner_id=actor and c.id in (select connection_id from public.agentgrid_social_deliveries where publication_id=publication.id)),'[]'::jsonb)); end if;
 if operation='claim-delivery' then
 if not execution.enabled or not policy.publish_enabled or delivery.state<>'pending' or publication.approved_at is null
 or publication.expires_at<=now() or publication.scheduled_at>now() or publication.digest is distinct from evidence->>'digest'
 or not connection.publishing_enabled or connection.owner_id<>actor or connection.expires_at<=now()
 or asset.owner_id<>actor or asset.metadata->>'sha256' is distinct from publication.preview->>'mediaSha256' then return 'false'::jsonb; end if;
 update public.agentgrid_social_deliveries set state='dispatching',started_at=now() where id=delivery.id; return 'true'::jsonb;
 end if;
 if operation='submitted-delivery' then
 if delivery.state<>'dispatching' or evidence->>'postId' is null or length(evidence->>'postId') not between 1 and 300
 or (delivery.provider_post_id is not null and delivery.provider_post_id is distinct from evidence->>'postId') then
 raise exception 'Delivery identity mismatch' using errcode='23514'; end if;
 update public.agentgrid_social_deliveries set provider_post_id=coalesce(evidence->>'postId',provider_post_id) where id=delivery.id;
 end if;
 if operation='finish-delivery' and (delivery.state='dispatching' or (delivery.state='uncertain' and evidence->>'postId' is not null)) then
 if evidence->>'postId' is not null and delivery.provider_post_id is distinct from evidence->>'postId' then
 raise exception 'Delivery identity mismatch' using errcode='23514'; end if;
 update public.agentgrid_social_deliveries set state=case when evidence->>'postId' is null then 'uncertain' else 'published' end,
 provider_post_id=coalesce(evidence->>'postId',provider_post_id) where id=delivery.id;
 end if;
 return 'null'::jsonb;
end; $$;
revoke all on function public.agentgrid_server_media(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_server_media(uuid,text,jsonb) to service_role;
