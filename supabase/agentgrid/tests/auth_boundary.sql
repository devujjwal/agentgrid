-- Synthetic temporary state only; no real identity, email, OTP or provider call.
do $tests$
declare role_name text;
begin
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.agentgrid_auth_sessions','select') or
   has_table_privilege(role_name,'public.agentgrid_auth_flows','insert') or
   has_function_privilege(role_name,'public.agentgrid_auth_session_load(text)','execute') or
   has_function_privilege(role_name,'public.agentgrid_auth_flow_consume(text,text,text,text)','execute') then
   raise exception 'Browser role can access private authentication state';
  end if;
 end loop;
 if has_table_privilege('service_role','public.agentgrid_auth_sessions','update') or
  has_function_privilege('service_role','public.agentgrid_auth_take_limit(text,text,integer,integer)','execute') then
  raise exception 'Unbounded authentication mutations exposed';
 end if;
end
$tests$;

set role service_role;
do $tests$
declare flow text:=repeat('a',64); browser text:=repeat('b',64); code text:=repeat('c',64); result text; i integer;
begin
 for i in 1..5 loop
  if not public.agentgrid_auth_allow('email',repeat('d',64),lpad(i::text,64,'0')) then raise exception 'Expected IP budget rejected early'; end if;
 end loop;
 if public.agentgrid_auth_allow('email',repeat('d',64),repeat('e',64)) then raise exception 'IP budget bypassed'; end if;
 if public.agentgrid_auth_allow('choose-my-limit',repeat('f',64),null) then raise exception 'Unknown budget accepted'; end if;
 perform public.agentgrid_auth_flow_create(flow,'email',browser,code,'synthetic-encrypted-state');
 if public.agentgrid_auth_flow_consume(flow,'email',repeat('e',64),code) is not null then raise exception 'Browser binding bypassed'; end if;
 for i in 1..5 loop
  if public.agentgrid_auth_flow_consume(flow,'email',browser,repeat('e',64)) is not null then raise exception 'Wrong code accepted'; end if;
 end loop;
 if public.agentgrid_auth_flow_consume(flow,'email',browser,code) is not null then raise exception 'Attempt budget bypassed'; end if;
 flow:=repeat('1',64);
 perform public.agentgrid_auth_flow_create(flow,'email',browser,code,'synthetic-encrypted-state');
 result:=public.agentgrid_auth_flow_consume(flow,'email',browser,code);
 if result is distinct from 'synthetic-encrypted-state' then raise exception 'Correct challenge unavailable'; end if;
 if public.agentgrid_auth_flow_consume(flow,'email',browser,code) is not null then raise exception 'Challenge replay accepted'; end if;
 flow:=repeat('2',64);
 perform public.agentgrid_auth_flow_create(flow,'google',browser,null,'synthetic-pkce-state');
 if public.agentgrid_auth_flow_consume(flow,'email',browser,null) is not null then raise exception 'Flow purpose confusion'; end if;
 if public.agentgrid_auth_flow_consume(flow,'google',browser,null) is distinct from 'synthetic-pkce-state' then raise exception 'Google flow unavailable'; end if;
 for i in 1..10 loop
  if not public.agentgrid_auth_session_create(lpad(i::text,64,'0'),repeat('9',64),'synthetic-session') then raise exception 'Session capacity rejected early'; end if;
 end loop;
 if public.agentgrid_auth_session_create(repeat('8',64),repeat('9',64),'synthetic-session') then raise exception 'Per-subject session capacity bypassed'; end if;
 if not public.agentgrid_auth_session_replace(lpad('1',64,'0'),1,'replacement-synthetic-session') then raise exception 'Session replacement failed'; end if;
 if public.agentgrid_auth_session_replace(lpad('1',64,'0'),1,'stale-write') then raise exception 'Stale refresh overwrote current session'; end if;
 perform public.agentgrid_auth_session_revoke(lpad('1',64,'0'));
 if exists(select 1 from public.agentgrid_auth_session_load(lpad('1',64,'0'))) then raise exception 'Revoked session readable'; end if;
end
$tests$;
reset role;
do $tests$
declare count_value integer;
begin
 select attempts into count_value from public.agentgrid_auth_flows where id_digest=repeat('a',64);
 if count_value<>5 then raise exception 'Denied verification attempts rolled back'; end if;
 select count into count_value from public.agentgrid_auth_limits where lane='email-ip' and key_digest=repeat('d',64);
 if count_value<>6 then raise exception 'Denied quota increments rolled back'; end if;
 -- Expired, unconsumed challenges and sessions fail closed before pruning.
 update public.agentgrid_auth_flows set created_at=pg_catalog.now()-interval '6 minutes',
  expires_at=pg_catalog.now()-interval '1 minute',state='pending',attempts=0 where id_digest=repeat('1',64);
 if public.agentgrid_auth_flow_consume(repeat('1',64),'email',repeat('b',64),repeat('c',64)) is not null then
  raise exception 'Expired challenge accepted'; end if;
 update public.agentgrid_auth_sessions set created_at=pg_catalog.now()-interval '31 days',
  expires_at=pg_catalog.now()-interval '1 day';
 if exists(select 1 from public.agentgrid_auth_session_load(lpad('2',64,'0'))) or
  public.agentgrid_auth_session_replace(lpad('2',64,'0'),1,'expired-write') then
  raise exception 'Expired session usable'; end if;
 perform public.agentgrid_auth_prune();
 if exists(select 1 from public.agentgrid_auth_sessions) then raise exception 'Expired temporary sessions not pruned'; end if;
 -- Do not leave synthetic auth rows in the subsequent portability fixture.
 delete from public.agentgrid_auth_limits;
 delete from public.agentgrid_auth_flows;
 delete from public.agentgrid_auth_sessions;
end
$tests$;
