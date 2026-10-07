# AgentGrid backend contracts

All application resources use `agentgrid_`. Version-controlled migrations under
`supabase/agentgrid/migrations` build the application in a clean Supabase project;
they do not reset the shared project or depend on PicMagic application tables.
Database/server isolation and physical-project risk are described in
[the shared backend boundary](SHARED_BACKEND.md).

## Resource lifecycle

`agentgrid_agents` holds stable resource/owner/slug/fork identity. Profile IDs are
stable business IDs behind private `agentgrid_identities` links to managed Auth.
Resource identity and fork lineage cannot be edited. `agentgrid_drafts` stores a
private working specification and editorial record with optimistic revisions.
Saving a stale revision fails rather than overwriting another tab's changes.

Submitting copies that bundle into immutable `agentgrid_agent_versions`, inserts
normalized platform relationships and creates a pending `agentgrid_submissions`
entry. Submission requires explicit usable rights and a strictly advancing
semantic version; rejected/withdrawn versions cannot be silently reused. Review
state/reasons stay separate from immutable content. Moderators see submitted
content, not a creator's private working drafts. Only one version per resource
may await review at a time.

The insertion trigger hashes the UTF-8 PostgreSQL JSONB text of the spec/editorial
bundle. It does not falsely mark PostgreSQL's STABLE `convert_to` expression as an
immutable generated column. Portable specification and raw artifact hashes have
their own explicit canonical/byte formats, documented with the specification.

`agentgrid_releases` points to the current live approved version. It stores private
prepared quality evidence; it is not an anonymous-readable table. A moderator JWT
cannot invoke its server-only publication RPC, even if it claims an admin role.
The future trusted endpoint must verify the moderator, load the immutable bundle,
run the full contract/editorial/host/artifact gate and bind the result to its digest.
Its project-wide privileged credential requires separate reviewed provisioning
before deployment. Ordinary community operations use verified user tokens/RLS.

Public projections select exact fields. First-party attribution comes only from
the private configured real founder profile; ownership/metadata supplied inside
a resource cannot grant it. Private creator bylines remain generic unless opted
into a public profile. Creator profiles need a published contribution to have a
public projection; separate SEO value gates determine indexability.

Fork creation requires an approved public source with explicit public-fork rights.
It retains the exact immutable source version and its original license. Relicensing
is not implicitly permitted. Bounded lineage projections preserve formerly-public
source identity/version attribution after takedown, without exposing blocked
instructions. Managed identity deletion replaces the source creator with a stable
deidentified tombstone. Downloads must also include derived attribution/provenance;
that distribution integration is still a later acceptance requirement.

## Live community boundaries

- Favorites are private to their member, including against moderators. Desired
  save state is idempotent; removing an unavailable resource remains possible.
- A member has one review per agent and identifies the actual approved version
  they used. Creators cannot review their own resource. Review text/context is
  plaintext and bounded. It is not a verified-install claim.
- Review content and its private moderation ledger are separate. New/edited
  reviews await moderation; stale moderation revisions fail. Only published
  reviews by active authors on available agents contribute to public averages.
  No reviews produces a null average, not an invented rating.
- Reports reference exactly one public agent/review/profile. Details are private
  to the reporter and staff; duplicate open reports are constrained. Resolution
  requires staff authority and cannot overwrite an already closed report.
- Moderation decisions produce immutable AgentGrid audit entries. Roles derive
  from AgentGrid tables and active membership, never user metadata or PicMagic.
  A compact per-member/action quota prevents unlimited database writes; HTTP/auth
  abuse prevention remains required in the application layer.

## Staff and account lifecycle

Staff delegation, revocation and suspension serialize on AgentGrid's configuration
row. Moderators cannot appoint admins or suspend accounts; those actions require
an active administrator. App-controlled actions cannot remove the last active
administrator. Existing JWTs immediately lose revoked authority through database
checks. No protected application gains or loses roles through these operations.

Explicit owner-confirmed AgentGrid deactivation archives owned resources, removes
private drafts/saves, withdraws pending submissions, hides authored reviews and
detaches/deidentifies the business profile. It never deletes a shared Auth user or
performs global sign-out. Immutable versions, report/security records and attribution
need documented retention/erasure handling; deactivation is not an assertion that
every historical artifact was erased. Public/static takedown and asset cleanup
must be rehearsed before this flow is accepted in the product.

External managed Auth deletion is allowed even for the last AgentGrid admin. It
must not block another application's legitimate account deletion. Operator recovery
then requires deliberate verification/reassociation, not metadata-derived privilege.
Bootstrap/recovery tooling, legal notices and real account journeys remain pending.

## Publishing and extraction

Live community state does not wait for static builds. Approved content remains the
last public version while a successor is pending. Public SEO snapshots will have
an allowlisted, independently verified batch/history and explicit failure recovery.
Emergency static takedown/freshness remains a Phase 6 launch gate; blocking live
queries alone does not remove an already exported page.

Extraction preserves business/resource IDs and immutable digests/lineage. Only the
private managed-identity links need Auth UUID reassociation. Rehearse with compatible
PostgreSQL serialization, check every bundle/file checksum and apply deliberate
migrations if database hash representation ever changes. Never delete old shared
resources as an automatic cleanup step. See the extraction runbook before cutover.

The local database acceptance runner tests synthetic identities, resources,
reviews, reports and governance in rolled-back transactions. It compares protected
schema/data/grant fingerprints and runs the same migrations in CI. It does not
create real users, publish agents, manufacture community activity or establish
that unimplemented HTTP/storage/UI flows are production-ready.
