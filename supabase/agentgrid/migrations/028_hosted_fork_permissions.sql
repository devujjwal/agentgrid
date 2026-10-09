-- AgentGrid-owned replacement only; no PicMagic resource or existing version changes.
create or replace function public.agentgrid_check_resource(spec jsonb, expected_slug text)
returns void language plpgsql set search_path=''
as $agentgrid_function$
declare permission jsonb; license text; grants jsonb;
begin
 if pg_catalog.jsonb_typeof(spec) is distinct from 'object'
   or pg_catalog.octet_length(spec::text)>120000
   or spec->>'schema_version' is distinct from '0.1'
   or spec#>>'{identity,slug}' is distinct from expected_slug
   or not coalesce(spec->>'version' ~ '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$',false)
   or char_length(spec->>'version')>24
   or not exists (select 1 from public.agentgrid_categories where slug=spec->>'category')
   or pg_catalog.jsonb_typeof(spec->'platforms') is distinct from 'array'
   or pg_catalog.jsonb_array_length(spec->'platforms') not between 1 and 10
   or pg_catalog.jsonb_typeof(spec->'permissions') is distinct from 'array'
   or pg_catalog.jsonb_array_length(spec->'permissions')>16 then
   raise exception 'Invalid resource envelope' using errcode='23514';
 end if;
 if exists (select 1 from pg_catalog.jsonb_object_keys(spec) as key
   where key not in ('schema_version','identity','version','category','purpose','capabilities','execution',
   'inputs','outputs','requirements','platforms','tools','permissions','safety','examples','pricing','license','extensions')) then
   raise exception 'Unknown resource field' using errcode='23514';
 end if;
 if exists (select 1 from pg_catalog.jsonb_array_elements(spec->'platforms') item
   where not exists (select 1 from public.agentgrid_platforms p where p.slug=item->>'slug'))
   or (select count(*)<>count(distinct item->>'slug') from pg_catalog.jsonb_array_elements(spec->'platforms') item) then
   raise exception 'Unknown or duplicate platform' using errcode='23514';
 end if;
 license := spec#>>'{license,identifier}'; grants := spec#>'{license,permissions}';
 if license is null or license not in ('unselected','CC-BY-4.0','CC0-1.0','MIT','custom','all-rights-reserved')
   or pg_catalog.jsonb_typeof(grants) is distinct from 'object'
   or pg_catalog.jsonb_typeof(grants->'use') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'modify') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'redistribute') is distinct from 'boolean'
   or pg_catalog.jsonb_typeof(grants->'public_fork') is distinct from 'boolean'
   or (license='unselected' and grants <> '{"use":false,"modify":false,"redistribute":false,"public_fork":false}'::jsonb)
   or (license in ('CC-BY-4.0','CC0-1.0','MIT') and grants <> '{"use":true,"modify":true,"redistribute":true,"public_fork":true}'::jsonb)
   or (license='all-rights-reserved' and (grants->>'redistribute'='true' or grants->>'public_fork'='true'))
   or (grants->>'public_fork'='true' and not (grants->>'use'='true' and grants->>'modify'='true' and (grants->>'redistribute'='true' or coalesce(spec#>>'{license,public_fork_scope}'='agentgrid-only',false)))) then
   raise exception 'Inconsistent reuse permissions' using errcode='23514';
 end if;
 -- An explicit hosted-only grant never implies general redistribution. An
 -- omitted scope retains the old license contract and immutable content digest.
 if (spec->'license') ? 'public_fork_scope' and (
   spec#>>'{license,public_fork_scope}' is distinct from 'agentgrid-only'
   or license<>'custom' or grants->>'public_fork'<>'true'
   or grants->>'redistribute'<>'false') then
   raise exception 'Invalid hosted fork scope' using errcode='23514';
 end if;
 for permission in select * from pg_catalog.jsonb_array_elements(spec->'permissions') loop
   if permission->>'operation' is null or permission->>'operation' not in ('read','write','network')
     or pg_catalog.jsonb_typeof(permission->'confirmation_required') is distinct from 'boolean'
     or (permission->>'operation'='write' and permission->>'confirmation_required'<>'true') then
     raise exception 'Invalid permission boundary' using errcode='23514';
   end if;
 end loop;
end;
$agentgrid_function$;
