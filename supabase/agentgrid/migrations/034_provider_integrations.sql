-- Provider adapters remain off. These tables contain no plaintext credentials.
alter table public.agentgrid_media_policy add column oauth_enabled boolean not null default false;
alter table public.agentgrid_social_connections add column scopes jsonb not null default '[]' check(jsonb_typeof(scopes)='array' and jsonb_array_length(scopes)<=30);
create table public.agentgrid_social_oauth_states (
 digest text primary key check(digest ~ '^[a-f0-9]{64}$'),
 owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 session_digest text not null check(session_digest ~ '^[a-f0-9]{64}$'),
 platform text not null check(platform in ('instagram','facebook','linkedin')),
 redirect_uri text not null check(redirect_uri ~ '^https://(agentgrid\.me|agentgrid-staging\.pages\.dev)/api/social/(instagram|facebook|linkedin)/callback/$'),
 expires_at timestamptz not null, consumed_at timestamptz, created_at timestamptz not null default now()
);
create table public.agentgrid_social_receipts (
 delivery_id uuid primary key references public.agentgrid_social_deliveries(id) deferrable initially immediate,
 owner_id uuid not null references public.agentgrid_profiles(id) deferrable initially immediate,
 connection_id uuid not null references public.agentgrid_social_connections(id) deferrable initially immediate,
 media_id uuid not null references public.agentgrid_media_assets(id) deferrable initially immediate,
 checksum text not null check(checksum ~ '^[a-f0-9]{64}$'), caption text not null check(length(caption) between 1 and 3000),
 stage text not null default 'started' check(stage in ('started','upload','publishing','published')),
 uploaded_id text check(length(uploaded_id) between 1 and 300), post_id text check(length(post_id) between 1 and 300),
 created_at timestamptz not null default now()
);
alter table public.agentgrid_social_oauth_states enable row level security;
alter table public.agentgrid_social_receipts enable row level security;
revoke all on public.agentgrid_social_oauth_states,public.agentgrid_social_receipts from public,anon,authenticated,service_role;
create index agentgrid_social_oauth_recent on public.agentgrid_social_oauth_states(owner_id,created_at desc);

create function public.agentgrid_server_integrations(actor_user_id uuid,operation text,evidence jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; policy public.agentgrid_media_policy; flow public.agentgrid_social_oauth_states;
 connection public.agentgrid_social_connections; receipt public.agentgrid_social_receipts; delivery public.agentgrid_social_deliveries;
 publication public.agentgrid_social_publications; asset public.agentgrid_media_assets; changed integer;
begin
 if operation is null or operation not in ('create-flow','consume-flow','connect','connection','begin','save','published','pending','recover')
 or evidence is null or jsonb_typeof(evidence)<>'object' or octet_length(evidence::text)>150000 then
 raise exception 'Invalid integration operation' using errcode='23514'; end if;
 select p.id into actor from public.agentgrid_identities i join public.agentgrid_profiles p on p.id=i.profile_id
 where i.user_id=actor_user_id and p.status='active';
 if actor is null then raise exception 'Active member required' using errcode='42501'; end if;
 perform 1 from public.agentgrid_execution_policy where singleton and enabled for update;
 if not found then raise exception 'Execution disabled' using errcode='42501'; end if;
 select * into policy from public.agentgrid_media_policy where singleton for update;
 if operation in ('create-flow','consume-flow','connect') then
 if not coalesce(policy.oauth_enabled,false) then raise exception 'Connections disabled' using errcode='42501'; end if;
 if operation='create-flow' then
 if (evidence->>'ownerId')::uuid<>actor or (evidence->>'expiresAt')::timestamptz not between now() and now()+interval '10 minutes'
 or (select count(*) from public.agentgrid_social_oauth_states where owner_id=actor and created_at>now()-interval '1 hour')>=10
 then raise exception 'Invalid OAuth flow' using errcode='23514'; end if;
 insert into public.agentgrid_social_oauth_states(digest,owner_id,session_digest,platform,redirect_uri,expires_at)
 values(evidence->>'digest',actor,evidence->>'sessionDigest',evidence->>'platform',evidence->>'redirectUri',(evidence->>'expiresAt')::timestamptz);
 return 'null'::jsonb;
 elsif operation='consume-flow' then
 update public.agentgrid_social_oauth_states set consumed_at=now() where digest=evidence->>'digest' and owner_id=actor
 and session_digest=evidence->>'sessionDigest' and platform=evidence->>'platform' and consumed_at is null and expires_at>now() returning * into flow;
 if not found then return 'null'::jsonb; end if;
 return jsonb_build_object('digest',flow.digest,'ownerId',flow.owner_id,'sessionDigest',flow.session_digest,'platform',flow.platform,'redirectUri',flow.redirect_uri,'expiresAt',flow.expires_at);
 else
 if (evidence->>'ownerId')::uuid<>actor or (evidence->>'expiresAt')::timestamptz<=now()
 or (select count(*) from public.agentgrid_social_connections where owner_id=actor)>=30 then raise exception 'Invalid connection' using errcode='23514'; end if;
 insert into public.agentgrid_social_connections(id,owner_id,platform,provider_account_id,expires_at,sealed_tokens,scopes)
 values((evidence->>'id')::uuid,actor,evidence->>'platform',evidence->>'accountId',(evidence->>'expiresAt')::timestamptz,evidence->>'sealedTokens',evidence->'scopes');
 return 'null'::jsonb;
 end if;
 end if;
 if not coalesce(policy.publish_enabled,false) then raise exception 'Publication disabled' using errcode='42501'; end if;
 select * into connection from public.agentgrid_social_connections where id=case when operation='save' then (select d.connection_id from public.agentgrid_social_deliveries d join public.agentgrid_social_publications p on p.id=d.publication_id where d.id=(evidence->>'deliveryId')::uuid and p.owner_id=actor) else (evidence->>'connectionId')::uuid end and owner_id=actor and publishing_enabled and expires_at>now() for update;
 if not found then raise exception 'Connection unavailable' using errcode='42501'; end if;
 if operation='connection' then
 return jsonb_build_object('id',connection.id,'ownerId',actor,'platform',connection.platform,'accountId',connection.provider_account_id,
 'expiresAt',connection.expires_at,'publishingEnabled',true,'sealedTokens',connection.sealed_tokens,'scopes',connection.scopes);
 elsif operation='recover' then
 select r.* into receipt from public.agentgrid_social_receipts r join public.agentgrid_social_deliveries d on d.id=r.delivery_id
 where r.delivery_id=(evidence->>'deliveryId')::uuid and r.owner_id=actor and r.connection_id=connection.id
 and r.stage='published' and d.state='uncertain' and d.provider_post_id is null for update of d;
 if not found then return 'null'::jsonb; end if;
 update public.agentgrid_social_deliveries set provider_post_id=receipt.post_id where id=receipt.delivery_id;
 return to_jsonb(receipt.post_id);
 elsif operation in ('published','pending') then
 select * into receipt from public.agentgrid_social_receipts where owner_id=actor and connection_id=connection.id and ((operation='published' and post_id=evidence->>'postId') or (operation='pending' and delivery_id=(evidence->>'deliveryId')::uuid))
 and media_id=(evidence->>'mediaId')::uuid and checksum=evidence->>'checksum' and caption=evidence->>'caption' and stage=case when operation='published' then 'published' else 'upload' end;
 if not found then return 'null'::jsonb; end if;
 return jsonb_build_object('mediaId',receipt.uploaded_id);
 end if;
 select d.* into delivery from public.agentgrid_social_deliveries d join public.agentgrid_social_publications p on p.id=d.publication_id
 where d.id=(evidence->>'deliveryId')::uuid and p.owner_id=actor and d.connection_id=connection.id for update of d;
 if not found or (delivery.state<>'dispatching' and not(operation='save' and evidence->>'stage'='publishing' and delivery.state='uncertain' and delivery.provider_post_id is null)) then raise exception 'Claimed delivery required' using errcode='42501'; end if;
 select * into publication from public.agentgrid_social_publications where id=delivery.publication_id;
 if publication.expires_at is null or publication.expires_at<=now() or publication.scheduled_at>now() then raise exception 'Fresh approval required' using errcode='42501'; end if;
 if operation='begin' then
 select * into asset from public.agentgrid_media_assets where id=publication.media_id and owner_id=actor;
 if asset.id is null or asset.id<>(evidence->>'mediaId')::uuid or asset.metadata->>'sha256'<>evidence->>'sha256'
 or not exists(select 1 from jsonb_array_elements(publication.preview->'destinations') dest where dest->>'connectionId'=connection.id::text and dest->>'caption'=evidence->>'caption')
 then raise exception 'Delivery binding mismatch' using errcode='23514'; end if;
 insert into public.agentgrid_social_receipts(delivery_id,owner_id,connection_id,media_id,checksum,caption)
 values(delivery.id,actor,connection.id,asset.id,evidence->>'sha256',evidence->>'caption') on conflict do nothing;
 get diagnostics changed=row_count;
 return to_jsonb(changed=1);
 end if;
 if evidence->>'providerId' is null or length(evidence->>'providerId') not between 1 and 300 then raise exception 'Invalid provider receipt' using errcode='23514'; end if;
 select * into receipt from public.agentgrid_social_receipts where delivery_id=delivery.id and owner_id=actor for update;
 if not found or not ((receipt.stage='started' and evidence->>'stage'='upload') or (receipt.stage='upload' and evidence->>'stage'='publishing' and evidence->>'providerId'=receipt.uploaded_id) or (receipt.stage='publishing' and evidence->>'stage'='published'))
 then raise exception 'Receipt transition refused' using errcode='23514'; end if;
 if delivery.state='uncertain' then update public.agentgrid_social_deliveries set state='dispatching',started_at=now() where id=delivery.id; end if;
 update public.agentgrid_social_receipts set stage=evidence->>'stage', uploaded_id=case when evidence->>'stage'='upload' then evidence->>'providerId' else uploaded_id end,
 post_id=case when evidence->>'stage'='published' then evidence->>'providerId' else post_id end where delivery_id=delivery.id;
 return 'null'::jsonb;
end $$;
revoke all on function public.agentgrid_server_integrations(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.agentgrid_server_integrations(uuid,text,jsonb) to service_role;
