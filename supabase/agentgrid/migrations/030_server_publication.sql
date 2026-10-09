-- Cloudflare-only adapter. The verified Auth subject is supplied by the server,
-- not browser JSON. No public/user role may call this privileged operation.
create function public.agentgrid_server_publication(actor_user_id uuid,operation text,request_id uuid,evidence jsonb default null)
returns jsonb language plpgsql security definer set search_path=''
as $agentgrid_function$
begin
 -- Governance and publication use this same lock. Recheck authority inside the
 -- transaction so revocation between HTTP admission and execution is effective.
 perform 1 from public.agentgrid_configuration where singleton for update;
 if actor_user_id is null or not exists(
  select 1 from public.agentgrid_identities i
  join public.agentgrid_profiles p on p.id=i.profile_id
  join public.agentgrid_user_roles r on r.user_id=p.id
  where i.user_id=actor_user_id and p.status='active' and r.role='administrator'
 ) then raise exception 'Active administrator required' using errcode='42501'; end if;
 if request_id is null or operation is null or operation not in ('inspect','prepare','publish')
 or (operation<>'publish' and evidence is not null)
 then raise exception 'Explicit bounded operation required' using errcode='23514'; end if;
 if operation='inspect' then return public.agentgrid_release_request_status(request_id); end if;
 if operation='prepare' then return public.agentgrid_prepare_release_request(request_id); end if;
 return public.agentgrid_execute_release_request(request_id,evidence);
end; $agentgrid_function$;
revoke all on function public.agentgrid_server_publication(uuid,text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_server_publication(uuid,text,uuid,jsonb) to service_role;
