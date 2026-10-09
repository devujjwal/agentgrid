-- Private approximate interaction counts, never public popularity or unique users.
-- No auth foreign keys, raw queries, URLs, IP addresses or user/session identifiers.
create table public.agentgrid_analytics_daily (
 day date not null, event text not null, dimension text not null check(length(dimension)<=120),
 count integer not null check(count between 1 and 2000),
 primary key(day,event,dimension)
);
alter table public.agentgrid_analytics_daily enable row level security;
revoke all on public.agentgrid_analytics_daily from public,anon,authenticated,service_role;

create function public.agentgrid_analytics_prune()
returns void language sql security definer set search_path=''
as $agentgrid_function$
 delete from public.agentgrid_analytics_daily where day < (current_timestamp at time zone 'UTC')::date - 29;
$agentgrid_function$;

create function public.agentgrid_analytics_record(measurement jsonb)
returns boolean language plpgsql security definer set search_path=''
as $agentgrid_function$
declare
 event_name text; dimension_name text; resource_id uuid; selected_version uuid; platform_name text;
 today date := (current_timestamp at time zone 'UTC')::date;
 quota integer; supplied_keys text[]; expected_keys text[];
begin
 if jsonb_typeof(measurement) is distinct from 'object' or octet_length(measurement::text)>512 then return false; end if;
 event_name := measurement->>'event';
 select array_agg(key order by key) into supplied_keys from jsonb_object_keys(measurement) as key;
 if event_name='page_view' then
  expected_keys:=array['event','page']; dimension_name:=measurement->>'page';
  if dimension_name is null or dimension_name not in ('home','agents','recipes','categories','learn','platforms','integrations','mcp') then return false; end if;
 elsif event_name='search' then
  expected_keys:=array['event','kind','results'];
  if measurement->>'kind' is null or measurement->>'results' is null or measurement->>'kind' not in ('all','agent','recipe','category','integration') or measurement->>'results' not in ('none','one','few','many') then return false; end if;
  dimension_name := (measurement->>'kind') || ':' || (measurement->>'results');
 elsif event_name in ('agent_view','copy_instructions','platform_select','definition_download') then
  expected_keys:=array['event','resourceId','versionId'];
  if event_name in ('copy_instructions','platform_select') then expected_keys:=array['event','platform','resourceId','versionId']; end if;
  begin resource_id:=(measurement->>'resourceId')::uuid; selected_version:=(measurement->>'versionId')::uuid;
  exception when invalid_text_representation then return false; end;
  if resource_id is null or selected_version is null or not public.agentgrid_is_public_agent(resource_id) or not exists(select 1 from public.agentgrid_releases where agent_id=resource_id and agentgrid_releases.version_id=selected_version) then return false; end if;
  dimension_name:=resource_id::text || ':' || selected_version::text;
  if event_name in ('copy_instructions','platform_select') then
   platform_name:=measurement->>'platform';
   if platform_name is null or length(platform_name)>40 or not exists(select 1 from public.agentgrid_agent_versions v, jsonb_array_elements(v.specification->'platforms') p where v.id=selected_version and p->>'slug'=platform_name) then return false; end if;
   dimension_name:=dimension_name || ':' || platform_name;
  end if;
 else return false;
 end if;
 if supplied_keys is distinct from expected_keys or exists(select 1 from jsonb_each(measurement) e where jsonb_typeof(e.value)<>'string') then return false; end if;
 -- Low-volume global ceiling; no visitor identifier is needed or retained.
 -- Counts are approximate, forgeable observations, not unique users or rankings.
 perform pg_catalog.pg_advisory_xact_lock(271092710);
 perform public.agentgrid_analytics_prune();
 select coalesce(sum(count),0) into quota from public.agentgrid_analytics_daily where day=today;
 if quota>=2000 then return false; end if;
 insert into public.agentgrid_analytics_daily(day,event,dimension,count) values(today,event_name,dimension_name,1)
 on conflict(day,event,dimension) do update set count=agentgrid_analytics_daily.count+1;
 return true;
end;
$agentgrid_function$;
create function public.agentgrid_analytics_summary()
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$
 select coalesce(jsonb_agg(to_jsonb(r) order by r.day,r.event),'[]'::jsonb)
 from (select day,event,sum(count)::integer as count from public.agentgrid_analytics_daily where day >= (current_timestamp at time zone 'UTC')::date - 29 group by day,event) r;
$agentgrid_function$;
revoke all on function public.agentgrid_analytics_record(jsonb),public.agentgrid_analytics_prune(),public.agentgrid_analytics_summary() from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_analytics_record(jsonb),public.agentgrid_analytics_prune(),public.agentgrid_analytics_summary() to service_role;
