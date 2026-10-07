alter table public.agentgrid_configuration add column first_party_profile_id uuid
references public.agentgrid_profiles(id) on delete restrict;
create index agentgrid_agent_versions_creator on public.agentgrid_agent_versions(submitted_by,created_at desc);
create index agentgrid_reviews_author on public.agentgrid_reviews(author_id,updated_at desc);
create index agentgrid_reports_reporter on public.agentgrid_reports(reporter_id,created_at desc);

create function public.agentgrid_protect_resource_identity()
returns trigger language plpgsql set search_path=''
as $agentgrid_function$ begin
 if new.id is distinct from old.id or new.slug is distinct from old.slug or new.owner_id is distinct from old.owner_id
   or new.forked_from_version_id is distinct from old.forked_from_version_id or new.created_at is distinct from old.created_at then
   raise exception 'Resource identity and fork lineage are immutable' using errcode='55000'; end if;
 return new;
end; $agentgrid_function$;
create trigger agentgrid_agents_identity_immutable before update on public.agentgrid_agents
for each row execute function public.agentgrid_protect_resource_identity();

-- Exact public columns. No working draft, private quality artifact, review
-- decision reason, consent/auth link or staff role is a public resource field.
create function public.agentgrid_public_resource(resource_slug text)
returns table(agent_id uuid,slug text,version_id uuid,version text,specification jsonb,editorial jsonb,
 released_at timestamptz,creator_name text,creator_username text,creator_kind text)
language sql stable security definer set search_path=''
as $agentgrid_function$
 select a.id,a.slug,v.id,v.version,v.specification,v.editorial,r.released_at,
 case when c.first_party_profile_id=p.id then 'AgentGrid Editorial'
   when p.visibility='public' then p.display_name else 'Community creator' end,
 case when p.visibility='public' then p.username else null end,
 case when c.first_party_profile_id=p.id then 'first-party' else 'community' end
 from public.agentgrid_agents a join public.agentgrid_releases r on r.agent_id=a.id
 join public.agentgrid_agent_versions v on v.id=r.version_id join public.agentgrid_profiles p on p.id=a.owner_id
 cross join public.agentgrid_configuration c
 where a.slug=resource_slug and c.singleton and public.agentgrid_is_public_agent(a.id);
$agentgrid_function$;

-- Return only formerly-public source identity/version attribution. Instructions
-- from a now-blocked source remain hidden. A deleted creator becomes a tombstone.
create function public.agentgrid_public_lineage(resource_id uuid)
returns table(depth integer,source_agent_id uuid,source_version_id uuid,source_slug text,
 source_version text,creator_name text,source_available boolean)
language sql stable security definer set search_path=''
as $agentgrid_function$
 with recursive lineage as (
   select 1 as depth,v.id,v.agent_id,a.owner_id,a.forked_from_version_id
   from public.agentgrid_agents requested join public.agentgrid_agent_versions v on v.id=requested.forked_from_version_id
   join public.agentgrid_agents a on a.id=v.agent_id
   where requested.id=resource_id and public.agentgrid_is_public_agent(requested.id)
   union all
   select l.depth+1,v.id,v.agent_id,a.owner_id,a.forked_from_version_id
   from lineage l join public.agentgrid_agent_versions v on v.id=l.forked_from_version_id
   join public.agentgrid_agents a on a.id=v.agent_id where l.depth<32
 )
 select l.depth,l.agent_id,l.id,a.slug,v.version,
 case when p.status='deactivated' then 'Deleted creator'
   when p.id=c.first_party_profile_id then 'AgentGrid Editorial'
   when p.visibility='public' then p.display_name else 'Community creator' end,
 public.agentgrid_is_public_agent(a.id)
 from lineage l join public.agentgrid_agent_versions v on v.id=l.id
 join public.agentgrid_agents a on a.id=l.agent_id join public.agentgrid_profiles p on p.id=l.owner_id
 cross join public.agentgrid_configuration c where c.singleton order by l.depth;
$agentgrid_function$;

create function public.agentgrid_public_review_byline(review_resource_id uuid)
returns table(display_name text,username text)
language sql stable security definer set search_path=''
as $agentgrid_function$
 select case when p.visibility='public' then p.display_name else 'Community member' end,
 case when public.agentgrid_is_public_profile(p.id) then p.username else null end
 from public.agentgrid_reviews r join public.agentgrid_profiles p on p.id=r.author_id
 where r.id=review_resource_id and public.agentgrid_is_public_review(r.id);
$agentgrid_function$;

revoke all on function public.agentgrid_protect_resource_identity(),public.agentgrid_public_resource(text),
 public.agentgrid_public_lineage(uuid),public.agentgrid_public_review_byline(uuid)
from public,anon,authenticated,service_role;
grant execute on function public.agentgrid_public_resource(text),public.agentgrid_public_lineage(uuid),
 public.agentgrid_public_review_byline(uuid) to anon,authenticated;
