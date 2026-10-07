-- Structural boundary checks complement effective RLS/RPC actor tests.
do $agentgrid_schema_boundary$
begin
 if exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relname like 'agentgrid\_%' escape '\' and c.relkind='r' and not c.relrowsecurity) then
   raise exception 'AgentGrid table is missing RLS'; end if;
 if exists(select 1 from pg_catalog.pg_constraint k join pg_catalog.pg_class c on c.oid=k.conrelid
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   join pg_catalog.pg_class rc on rc.oid=k.confrelid join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
   where k.contype='f' and n.nspname='public' and c.relname like 'agentgrid\_%' escape '\'
   and (not k.condeferrable or k.condeferred
     or not ((rn.nspname='public' and rc.relname like 'agentgrid\_%' escape '\') or (rn.nspname='auth' and rc.relname='users')))) then
   raise exception 'AgentGrid foreign-key/extraction boundary is invalid'; end if;
 if exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname like 'agentgrid\_%' escape '\'
   and not coalesce('search_path=""'=any(p.proconfig),false)) then
   raise exception 'AgentGrid function search path is not confined'; end if;
 if exists(select 1 from information_schema.role_table_grants
   where table_schema='public' and table_name like 'agentgrid\_%' escape '\'
   and grantee in ('anon','authenticated','service_role') and privilege_type<>'SELECT') then
   raise exception 'Unexpected direct application-table mutation grant'; end if;
 if exists(select 1 from information_schema.role_column_grants
   where table_schema='public' and table_name like 'agentgrid\_%' escape '\'
   and grantee in ('anon','authenticated','service_role') and privilege_type<>'SELECT') then
   raise exception 'Unexpected direct column mutation grant'; end if;
end;
$agentgrid_schema_boundary$;
