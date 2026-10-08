-- Public content capture has an explicit consistency fence. Community counters
-- and private working drafts do not invalidate static content.
create table public.agentgrid_publication_state (
 singleton boolean primary key default true check(singleton),
 revision bigint not null default 0 check(revision between 0 and 9007199254740991)
);
insert into public.agentgrid_publication_state(singleton) values(true);
alter table public.agentgrid_publication_state enable row level security;
revoke all on public.agentgrid_publication_state from public,anon,authenticated,service_role;
create function public.agentgrid_advance_publication_revision()
returns trigger language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if tg_table_name='agentgrid_agents' then
  if not exists(select 1 from public.agentgrid_releases where agent_id=new.id) then return null; end if;
 end if;
 update public.agentgrid_publication_state set revision=revision+1 where singleton;
 return null;
end; $agentgrid_function$;
create trigger agentgrid_release_snapshot_changed after insert or update or delete on public.agentgrid_releases
for each statement execute function public.agentgrid_advance_publication_revision();
create trigger agentgrid_resource_snapshot_changed after update of status on public.agentgrid_agents
for each row when(old.status is distinct from new.status) execute function public.agentgrid_advance_publication_revision();
create trigger agentgrid_attribution_snapshot_changed after update of first_party_profile_id on public.agentgrid_configuration
for each row when(old.first_party_profile_id is distinct from new.first_party_profile_id) execute function public.agentgrid_advance_publication_revision();
create function public.agentgrid_profile_publication_changed()
returns trigger language plpgsql security definer set search_path=''
as $agentgrid_function$ begin
 if exists(select 1 from public.agentgrid_agents a join public.agentgrid_releases r on r.agent_id=a.id where a.owner_id=new.id) then
 update public.agentgrid_publication_state set revision=revision+1 where singleton;
 end if;
 return null;
end; $agentgrid_function$;
create trigger agentgrid_creator_snapshot_changed after update of display_name,username,bio,website_url,visibility,status on public.agentgrid_profiles
for each row when((old.display_name,old.username,old.bio,old.website_url,old.visibility,old.status) is distinct from
 (new.display_name,new.username,new.bio,new.website_url,new.visibility,new.status)) execute function public.agentgrid_profile_publication_changed();

-- An opaque public-delivery tag captures version, visibility and attribution,
-- including formerly-public fork ancestors. It exposes no private profile IDs.
create function public.agentgrid_public_delivery_state(resource_slug text)
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$
 select pg_catalog.jsonb_build_object('resourceId',a.id,'versionId',r.version_id,'slug',a.slug,
 'tag',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.jsonb_build_object(
 'version',r.version_id,'releasedAt',r.released_at,'accessRevision',a.moderation_revision,
 'creator',pg_catalog.jsonb_build_array(p.display_name,p.username,p.bio,p.website_url,p.visibility,p.status),'firstParty',p.id=c.first_party_profile_id,
 'lineage',(select coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.depth),'[]'::jsonb) from public.agentgrid_public_lineage(a.id) l)
 )::text,'UTF8')),'hex'))
 from public.agentgrid_agents a join public.agentgrid_releases r on r.agent_id=a.id
 join public.agentgrid_profiles p on p.id=a.owner_id cross join public.agentgrid_configuration c
 where c.singleton and a.slug=resource_slug and public.agentgrid_is_public_agent(a.id);
$agentgrid_function$;
create function public.agentgrid_publication_index(after_id uuid default null)
returns jsonb language sql stable security definer set search_path=''
as $agentgrid_function$
 with visible as (
 select a.id,a.slug from public.agentgrid_agents a where (after_id is null or a.id>after_id)
 and public.agentgrid_is_public_agent(a.id) order by a.id limit 251
 ), selected as (select * from visible order by id limit 250)
 select pg_catalog.jsonb_build_object('revision',(select revision from public.agentgrid_publication_state where singleton),
 'items',(select coalesce(pg_catalog.jsonb_agg(public.agentgrid_public_delivery_state(slug) order by id),'[]'::jsonb) from selected),
 'hasMore',(select count(*)>250 from visible));
$agentgrid_function$;
revoke all on function public.agentgrid_advance_publication_revision(),public.agentgrid_profile_publication_changed(),
 public.agentgrid_public_delivery_state(text),public.agentgrid_publication_index(uuid) from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_public_delivery_state(text),public.agentgrid_publication_index(uuid) to anon,authenticated;
