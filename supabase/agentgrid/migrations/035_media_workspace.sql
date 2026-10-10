-- Private workspace controls. No execution flag, budget, credential or role is activated.
alter table public.agentgrid_social_connections add column display_label text not null default 'Connected account' check(length(display_label) between 1 and 160);
alter function public.agentgrid_server_integrations(uuid,text,jsonb) rename to agentgrid_server_integrations_v1;
revoke all on function public.agentgrid_server_integrations_v1(uuid,text,jsonb) from public,anon,authenticated,service_role;
create function public.agentgrid_server_integrations(actor_user_id uuid,operation text,evidence jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if operation='connect' and (jsonb_typeof(evidence->'label') is distinct from 'string' or length(evidence->>'label') not between 1 and 160) then raise exception 'Account label required' using errcode='23514'; end if;
 result:=public.agentgrid_server_integrations_v1(actor_user_id,operation,evidence);
 if operation='connect' then update public.agentgrid_social_connections set display_label=evidence->>'label' where id=(evidence->>'id')::uuid and owner_id=(evidence->>'ownerId')::uuid; end if;
 return result;
end $$;
revoke all on function public.agentgrid_server_integrations(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.agentgrid_server_integrations(uuid,text,jsonb) to service_role;

create function public.agentgrid_server_media_workspace(actor_user_id uuid,operation text,evidence jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; execution public.agentgrid_execution_policy; policy public.agentgrid_media_policy; budget public.agentgrid_execution_budgets; connection public.agentgrid_social_connections; publication public.agentgrid_social_publications; result jsonb;
begin
 if operation is null or operation not in ('overview','enable-connection','disable-connection','cancel-publication') or evidence is null or jsonb_typeof(evidence)<>'object' or octet_length(evidence::text)>10000 then raise exception 'Invalid workspace operation' using errcode='23514'; end if;
 select p.id into actor from public.agentgrid_profiles p join public.agentgrid_identities i on i.profile_id=p.id where i.user_id=actor_user_id and p.status='active';
 if actor is null then raise exception 'Active member required' using errcode='42501'; end if;
 select * into execution from public.agentgrid_execution_policy where singleton for update;
 select * into policy from public.agentgrid_media_policy where singleton for update;
 if policy.singleton is null or execution.singleton is null then raise exception 'Policy unavailable' using errcode='42501'; end if;
 select * into budget from public.agentgrid_execution_budgets where profile_id=actor;
 if operation='overview' then
 return jsonb_build_object('observedAt',now(),'capabilities',jsonb_build_object('connect',execution.enabled and policy.oauth_enabled,'render',execution.enabled and policy.render_enabled,'publish',execution.enabled and policy.publish_enabled,'schedule',execution.enabled and policy.publish_enabled),
 'budget',jsonb_build_object('limitMicros',coalesce(budget.limit_micros,0),'heldMicros',coalesce(budget.held_micros,0),'spentMicros',coalesce(budget.spent_micros,0)),
 'siteBudget',jsonb_build_object('limitMicros',execution.limit_micros,'heldMicros',execution.held_micros,'spentMicros',execution.spent_micros),
 'sources',coalesce((select jsonb_agg(jsonb_build_object('id',r.id)) from (select id from public.agentgrid_execution_runs where owner_id=actor and state='succeeded' order by created_at desc limit 20) r),'[]'::jsonb),
 'connections',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'platform',c.platform,'label',c.display_label,'expiresAt',c.expires_at,'publishingEnabled',c.publishing_enabled)) from public.agentgrid_social_connections c where c.owner_id=actor),'[]'::jsonb),
 'reels',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'plan',r.snapshot->'plan','digest',r.digest,'maximumCostMicros',r.maximum_cost_micros,'state',r.state,'approvedAt',r.approved_at,'asset',(select jsonb_build_object('id',a.id,'sha256',a.metadata->>'sha256','seconds',a.metadata->'seconds') from public.agentgrid_media_assets a where a.reel_id=r.id))) from (select * from public.agentgrid_reels where owner_id=actor order by created_at desc limit 20) r),'[]'::jsonb),
 'publications',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'preview',p.preview,'digest',p.digest,'approvedAt',p.approved_at,'expiresAt',p.expires_at,'deliveries',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'connectionId',d.connection_id,'state',d.state,'canResume',d.state='uncertain' and d.provider_post_id is null and exists(select 1 from public.agentgrid_social_receipts receipt where receipt.delivery_id=d.id and receipt.stage='upload'))) from public.agentgrid_social_deliveries d where d.publication_id=p.id),'[]'::jsonb))) from (select * from public.agentgrid_social_publications where owner_id=actor order by scheduled_at desc limit 20) p),'[]'::jsonb));
 elsif operation='cancel-publication' then
 select * into publication from public.agentgrid_social_publications where id=(evidence->>'id')::uuid and owner_id=actor for update;
 if not found then raise exception 'Publication unavailable' using errcode='42501'; end if;
 update public.agentgrid_social_publications set approved_at=null,expires_at=null where id=publication.id;
 update public.agentgrid_social_deliveries set state='cancelled' where publication_id=publication.id and state='pending';
 -- An in-flight or completed external request cannot be undone by cancellation.
 return 'null'::jsonb;
 end if;
 select * into connection from public.agentgrid_social_connections where id=(evidence->>'id')::uuid and owner_id=actor for update;
 if not found then raise exception 'Connection unavailable' using errcode='42501'; end if;
 if operation='enable-connection' then
 if not execution.enabled or not policy.publish_enabled or connection.expires_at<=now() or evidence->>'confirmed' is distinct from 'true'
 or connection.platform is distinct from evidence->>'platform' or connection.display_label is distinct from evidence->>'label'
 or connection.expires_at is distinct from (evidence->>'expiresAt')::timestamptz or connection.sealed_tokens='v1.000000000000000000000000.00'
 or (connection.platform='instagram' and not connection.scopes @> '["instagram_basic","instagram_content_publish","pages_read_engagement"]'::jsonb)
 or (connection.platform='facebook' and not connection.scopes @> '["pages_manage_posts","pages_read_engagement"]'::jsonb)
 or (connection.platform='linkedin' and not connection.scopes @> '["w_member_social","r_member_social"]'::jsonb)
 then raise exception 'Connection approval refused' using errcode='42501'; end if;
 update public.agentgrid_social_connections set publishing_enabled=true where id=connection.id;
 else
 update public.agentgrid_social_connections set publishing_enabled=false where id=connection.id;
 update public.agentgrid_social_deliveries d set state='cancelled' from public.agentgrid_social_publications p where p.id=d.publication_id and p.owner_id=actor and d.connection_id=connection.id and d.state='pending';
 end if;
 return 'null'::jsonb;
end $$;
revoke all on function public.agentgrid_server_media_workspace(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.agentgrid_server_media_workspace(uuid,text,jsonb) to service_role;

-- Trusted private scheduler reads due approved ledger rows; no identities come from a browser.
create function public.agentgrid_due_social_jobs() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(job),'[]'::jsonb) from (
 select distinct on(d.id) jsonb_build_object('kind','publish','subject',i.user_id,'id',d.id,'digest',p.digest) job,d.id from public.agentgrid_social_deliveries d
 join public.agentgrid_social_publications p on p.id=d.publication_id join public.agentgrid_profiles member on member.id=p.owner_id and member.status='active'
 join public.agentgrid_identities i on i.profile_id=member.id join public.agentgrid_social_connections c on c.id=d.connection_id and c.owner_id=member.id and c.publishing_enabled and c.expires_at>now()
 where d.state='pending' and p.approved_at is not null and p.expires_at>now() and p.scheduled_at<=now()
 and exists(select 1 from public.agentgrid_execution_policy where singleton and enabled)
 and exists(select 1 from public.agentgrid_media_policy where singleton and publish_enabled)
 order by d.id,i.user_id limit 50) due;
$$;
revoke all on function public.agentgrid_due_social_jobs() from public,anon,authenticated;
grant execute on function public.agentgrid_due_social_jobs() to service_role;
