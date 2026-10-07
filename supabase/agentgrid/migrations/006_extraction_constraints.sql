-- Normal application transactions still check FKs immediately. A deliberate
-- extraction can defer only owned constraints while remapping private Auth IDs
-- and importing fork/configuration references in one atomic transaction.
do $agentgrid_extraction_constraints$
declare owned_fk record;
begin
 for owned_fk in
   select c.relname as table_name,k.conname as constraint_name,
     rn.nspname as referenced_schema,rc.relname as referenced_table
   from pg_catalog.pg_constraint k
   join pg_catalog.pg_class c on c.oid=k.conrelid
   join pg_catalog.pg_namespace n on n.oid=c.relnamespace
   join pg_catalog.pg_class rc on rc.oid=k.confrelid
   join pg_catalog.pg_namespace rn on rn.oid=rc.relnamespace
   where k.contype='f' and n.nspname='public' and c.relname like 'agentgrid\_%' escape '\'
 loop
   if owned_fk.constraint_name not like 'agentgrid\_%' escape '\'
     or not ((owned_fk.referenced_schema='public' and owned_fk.referenced_table like 'agentgrid\_%' escape '\')
       or (owned_fk.referenced_schema='auth' and owned_fk.referenced_table='users')) then
     raise exception 'An AgentGrid foreign key crosses the application boundary' using errcode='23514';
   end if;
   execute pg_catalog.format('alter table public.%I alter constraint %I deferrable initially immediate',
     owned_fk.table_name,owned_fk.constraint_name);
 end loop;
end;
$agentgrid_extraction_constraints$;
