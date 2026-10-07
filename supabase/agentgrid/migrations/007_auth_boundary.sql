-- AgentGrid ephemeral identity state. No PicMagic or managed Auth DDL/data.
-- Provider tokens/identity are encrypted by the backend, not plaintext columns.
create table public.agentgrid_auth_limits (
 lane text not null check(lane in ('email-ip','email-address','email-day','email-month','google-ip','google-day','verify-ip','verify-day','session-day')),
 key_digest text not null check(key_digest ~ '^[a-f0-9]{64}$'),
 window_started_at timestamptz not null,
 expires_at timestamptz not null,
 count integer not null check(count between 1 and 1001),
 primary key(lane,key_digest,window_started_at)
);
create index agentgrid_auth_limits_expiry on public.agentgrid_auth_limits(expires_at);

create table public.agentgrid_auth_flows (
 id_digest text primary key check(id_digest ~ '^[a-f0-9]{64}$'),
 purpose text not null check(purpose in ('email','google')),
 binding_digest text not null check(binding_digest ~ '^[a-f0-9]{64}$'),
 code_digest text check(code_digest is null or code_digest ~ '^[a-f0-9]{64}$'),
 sealed_state text not null check(octet_length(sealed_state) between 1 and 40000),
 attempts integer not null default 0 check(attempts between 0 and 5),
 state text not null default 'pending' check(state in ('pending','used')),
 created_at timestamptz not null default pg_catalog.clock_timestamp(),
 expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '10 minutes'),
 check((purpose='email' and code_digest is not null) or (purpose='google' and code_digest is null))
);
create index agentgrid_auth_flows_expiry on public.agentgrid_auth_flows(expires_at);

create table public.agentgrid_auth_sessions (
 id_digest text primary key check(id_digest ~ '^[a-f0-9]{64}$'),
 subject_digest text not null check(subject_digest ~ '^[a-f0-9]{64}$'),
 sealed_state text not null check(octet_length(sealed_state) between 1 and 40000),
 revision bigint not null default 1 check(revision>0),
 created_at timestamptz not null default pg_catalog.clock_timestamp(),
 expires_at timestamptz not null,
 check(expires_at>created_at and expires_at<=created_at+interval '30 days')
);
create index agentgrid_auth_sessions_expiry on public.agentgrid_auth_sessions(expires_at);
create index agentgrid_auth_sessions_subject on public.agentgrid_auth_sessions(subject_digest,created_at);

create function public.agentgrid_auth_take_limit(lane_name text, digest text, seconds integer, maximum integer)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$
declare boundary timestamptz; used integer;
begin
 if digest is null or digest !~ '^[a-f0-9]{64}$' or seconds is null or seconds not between 1 and 2592000 or maximum is null or maximum not between 1 and 1000 then
  raise exception 'Invalid authentication budget' using errcode='23514';
 end if;
 boundary:=pg_catalog.to_timestamp(pg_catalog.floor(extract(epoch from pg_catalog.clock_timestamp())/seconds)*seconds);
 insert into public.agentgrid_auth_limits as limits(lane,key_digest,window_started_at,expires_at,count)
 values(lane_name,digest,boundary,boundary+pg_catalog.make_interval(secs=>seconds),1)
 on conflict(lane,key_digest,window_started_at) do update set count=least(limits.count+1,maximum+1)
 returning count into used;
 return used<=maximum;
end
$agentgrid_function$;

create function public.agentgrid_auth_allow(action_name text, ip_digest text, address_digest text default null)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$
declare global_digest text:=pg_catalog.repeat('0',64);
begin
 perform public.agentgrid_auth_prune();
 -- Denied attempts return false, preserving quota increments; exceptions would
 -- roll them back. Global budgets bound row creation from changing IPs. IP
 -- precedes address so one denied caller cannot fill the address index.
 if action_name='email' then
  if address_digest is null or address_digest !~ '^[a-f0-9]{64}$' then return false; end if;
  if not public.agentgrid_auth_take_limit('email-day',global_digest,86400,25) then return false; end if;
  if not public.agentgrid_auth_take_limit('email-month',global_digest,2592000,750) then return false; end if;
  if not public.agentgrid_auth_take_limit('email-ip',ip_digest,3600,5) then return false; end if;
  if not public.agentgrid_auth_take_limit('email-address',address_digest,3600,3) then return false; end if;
  return true;
 elsif action_name='google' then
  if not public.agentgrid_auth_take_limit('google-day',global_digest,86400,1000) then return false; end if;
  return public.agentgrid_auth_take_limit('google-ip',ip_digest,3600,60);
 elsif action_name='verify' then
  if not public.agentgrid_auth_take_limit('verify-day',global_digest,86400,1000) then return false; end if;
  return public.agentgrid_auth_take_limit('verify-ip',ip_digest,3600,30);
 end if;
 return false;
end
$agentgrid_function$;

create function public.agentgrid_auth_flow_create(flow_digest text, flow_purpose text, browser_binding text, verification_digest text, encrypted_state text)
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
declare created timestamptz:=pg_catalog.clock_timestamp();
begin
 insert into public.agentgrid_auth_flows(id_digest,purpose,binding_digest,code_digest,sealed_state,created_at,expires_at)
 values(flow_digest,flow_purpose,browser_binding,verification_digest,encrypted_state,created,
  created+case when flow_purpose='email' then interval '5 minutes' else interval '10 minutes' end);
end
$agentgrid_function$;

create function public.agentgrid_auth_flow_consume(flow_digest text, flow_purpose text, browser_binding text, verification_digest text default null)
returns text language plpgsql security definer set search_path=''
as $agentgrid_function$
declare flow public.agentgrid_auth_flows%rowtype;
begin
 select * into flow from public.agentgrid_auth_flows where id_digest=flow_digest for update;
 if not found or flow.state<>'pending' or flow.purpose is distinct from flow_purpose
  or flow.binding_digest is distinct from browser_binding or flow.expires_at<=pg_catalog.clock_timestamp() or flow.attempts>=5 then
  return null;
 end if;
 update public.agentgrid_auth_flows set attempts=attempts+1 where id_digest=flow_digest;
 if flow.code_digest is distinct from verification_digest then return null; end if;
 update public.agentgrid_auth_flows set state='used' where id_digest=flow_digest;
 return flow.sealed_state;
end
$agentgrid_function$;

create function public.agentgrid_auth_session_create(session_digest text, verified_subject_digest text, encrypted_state text)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$
declare created timestamptz:=pg_catalog.clock_timestamp();
begin
 if not public.agentgrid_auth_take_limit('session-day',pg_catalog.repeat('0',64),86400,1000) then return false; end if;
 -- Bound encrypted-state storage across many distinct identities as well.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('agentgrid_auth_capacity',0));
 if (select count(*) from public.agentgrid_auth_sessions where expires_at>pg_catalog.clock_timestamp())>=1500 then return false; end if;
 -- Serialize per-subject capacity checks across separate edge requests. A hash
 -- collision only shares a lock; no data or authority is inferred from it.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(verified_subject_digest,0));
 if (select count(*) from public.agentgrid_auth_sessions where subject_digest=verified_subject_digest and expires_at>pg_catalog.clock_timestamp())>=10 then return false; end if;
 insert into public.agentgrid_auth_sessions(id_digest,subject_digest,sealed_state,created_at,expires_at)
 values(session_digest,verified_subject_digest,encrypted_state,created,created+interval '30 days');
 return true;
end
$agentgrid_function$;

create function public.agentgrid_auth_session_load(session_digest text)
returns table(encrypted_state text,revision bigint,expires_at timestamptz)
language sql stable security definer set search_path=''
as $agentgrid_function$
 select sealed_state,revision,expires_at from public.agentgrid_auth_sessions
 where id_digest=session_digest and expires_at>pg_catalog.now();
$agentgrid_function$;

create function public.agentgrid_auth_session_replace(session_digest text, expected_revision bigint, encrypted_state text)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$
begin
 update public.agentgrid_auth_sessions set sealed_state=encrypted_state,revision=revision+1
 where id_digest=session_digest and revision=expected_revision and expires_at>pg_catalog.clock_timestamp();
 return found;
end
$agentgrid_function$;

create function public.agentgrid_auth_session_revoke(session_digest text)
returns void language sql security definer set search_path=''
as $agentgrid_function$
 delete from public.agentgrid_auth_sessions where id_digest=session_digest;
$agentgrid_function$;

-- Expired temporary state only. Never a profile/content/Auth deletion or job.
create function public.agentgrid_auth_prune()
returns void language plpgsql security definer set search_path=''
as $agentgrid_function$
begin
 delete from public.agentgrid_auth_limits where ctid in (select ctid from public.agentgrid_auth_limits where expires_at<pg_catalog.clock_timestamp()-interval '1 day' limit 100);
 delete from public.agentgrid_auth_flows where ctid in (select ctid from public.agentgrid_auth_flows where expires_at<pg_catalog.clock_timestamp()-interval '1 day' limit 100);
 delete from public.agentgrid_auth_sessions where ctid in (select ctid from public.agentgrid_auth_sessions where expires_at<pg_catalog.clock_timestamp() limit 100);
end
$agentgrid_function$;

alter table public.agentgrid_auth_limits enable row level security;
alter table public.agentgrid_auth_flows enable row level security;
alter table public.agentgrid_auth_sessions enable row level security;
revoke all on public.agentgrid_auth_limits,public.agentgrid_auth_flows,public.agentgrid_auth_sessions from public,anon,authenticated,service_role;
revoke all on function public.agentgrid_auth_take_limit(text,text,integer,integer),public.agentgrid_auth_allow(text,text,text),
 public.agentgrid_auth_flow_create(text,text,text,text,text),public.agentgrid_auth_flow_consume(text,text,text,text),
 public.agentgrid_auth_session_create(text,text,text),public.agentgrid_auth_session_load(text),
 public.agentgrid_auth_session_replace(text,bigint,text),public.agentgrid_auth_session_revoke(text),public.agentgrid_auth_prune()
 from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_auth_allow(text,text,text),public.agentgrid_auth_flow_create(text,text,text,text,text),
 public.agentgrid_auth_flow_consume(text,text,text,text),public.agentgrid_auth_session_create(text,text,text),
 public.agentgrid_auth_session_load(text),public.agentgrid_auth_session_replace(text,bigint,text),
 public.agentgrid_auth_session_revoke(text),public.agentgrid_auth_prune() to service_role;
