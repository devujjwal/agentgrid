# AgentGrid shared infrastructure boundary

The owner explicitly approved temporary physical consolidation in PicMagic's
Supabase project `lxecbrvzpmgjmsqiachc`. There is no shared application data model.
All existing non-AgentGrid resources are protected, including other applications
already present in this project.

## Observed baseline

The read-only inventory found PicMagic editorial resources in `public`, protected
VS-MJR resources with `vsmjr_` names, Wonder resources in `public` and
`wonder_private`, and existing public asset buckets. No AgentGrid naming collisions
or application triggers on `auth.users` were found.

PicMagic authorization checks `public.admin_users` through `public.is_admin()`.
Ordinary authenticated users cannot self-insert admin roles. AgentGrid will never
call that authorization function or use those role rows. Existing RPC
`save_collection` explicitly checks PicMagic admin authorization. Existing Wonder
administrative RPCs are not executable by `anon`/`authenticated`.

Initial read-only checks denied private PicMagic content and roles for anonymous
and synthetic ordinary authenticated identities. Existing public content remains
public. This evidence does not establish isolation for code that does not yet exist.

## Repeatable guard

```sh
python3 scripts/inspect-shared-supabase.py --verify --rls
```

The script reads the existing Supabase CLI credential, validates its format,
passes it to macOS curl through stdin, and preserves normal TLS verification.
It never prints tokens, SMTP passwords, OAuth secrets, auth-user rows or application
records. Metadata fingerprints are stored privately in `.git`, with mode 0600;
they are not publication inputs or repository content.

Run the inventory once to record the protected baseline before applying AgentGrid
migrations. Verification fails on protected table shape, ACL, policy, function,
trigger, bucket or shared-auth changes. Investigate differences; never silently
replace a baseline to make a failed check pass. Authorized additive OAuth/callback
changes must have their exact diff recorded and reviewed separately. Scheduler
resources must be inventoried before any scheduled jobs are introduced.

## Migration and authorization rules

- Name every AgentGrid-owned table, function, RPC, trigger, helper, view, index,
  constraint, storage bucket and application job with `agentgrid_`.
- Prefixing is necessary but does not prove isolation: a new storage policy can
  still grant access to a protected bucket. Test effective access.
- Keep migrations under a dedicated AgentGrid path and maintain independent
  migration tracking. Do not use an existing application's migration history or
  destructive reset commands on the remote shared project.
- Reference shared `auth.users` only for identity. AgentGrid roles, profile state,
  moderation permissions and creator ownership come from AgentGrid tables.
- Do not create automatic AgentGrid profiles for all PicMagic signups; provision
  an AgentGrid profile explicitly when a user enters AgentGrid.
- Do not change global/default grants, JWT signing keys, existing Site URL,
  SMTP settings, email templates, existing callback URLs or protected RLS.
- Test anonymous, authenticated non-member, owner, different user, moderator and
  administrator. AgentGrid admin status must confer no PicMagic admin privileges.
- Test attempted writes and RPC calls, not just reads. Clone only schema needed
  for test fixtures into an isolated local database; never copy private user data.

## Guarded shared-project rollout

`python3 scripts/apply-shared-agentgrid-migrations.py` is a read-only provider
preflight. It verifies the protected baseline and authorized auth transition,
checks prefix collisions and recognizes only contiguous checksum-bound owned
history. It never adopts unexplained AgentGrid schema/history drift.

Application requires `--apply --commit <exact-main-SHA>`, a clean personal main
checkout, unchanged global identity, the verified personal private remote and a
successful exact-main push Validate run. Inputs must be committed regular SQL
files. Each additive migration/history row is one transaction with bounded lock
and statement timeouts. Protected checks run before and after each stage; private
mode-0600 owned-state/intent records bind its exact source and result. A lost
response is reconciled against the exact before/after history instead of blindly
retrying DDL. These records never replace the original protected baseline. This
operator is intentionally specific to the temporarily shared source project;
portable migration definitions and the extraction rehearsal build a clean target.

## Authentication adapter

AgentGrid-specific email should use Supabase's server-only OTP generation and an
AgentGrid-only Resend sending credential. Supabase supports custom delivery via
[`generateLink`](https://supabase.com/docs/reference/javascript/auth-admin-generatelink).
This avoids changing the shared project's SMTP and email templates. The server
transport and an explicit owner-only provider proof are implemented. The live
proof validates delivery to the recipient server, code verification, replay
rejection and local-only sign-out. The complete application flow still requires
expiry, abuse, session/CSRF and account-linking validation before acceptance.

Google requires an AgentGrid OAuth client and additive provider/callback setup;
see [Supabase Google configuration](https://supabase.com/docs/guides/auth/social-login/auth-google).
Preserve existing PicMagic redirects and explicitly supply AgentGrid's callback
on every AgentGrid flow. Limit Google scopes to identity, email and profile.

Shared Auth inherently shares identities, quotas, token lifecycle and service
availability. Signing out must use local scope so it does not revoke another
application's sessions. Account deletion cannot delete shared `auth.users` while
another application may depend on that identity; remove AgentGrid-owned data only
through a deliberate retention/deletion flow. Email/account changes need the
same cross-application care.

Privileged Supabase keys are project-wide. Keep them server-only and confine their
use to narrowly defined auth/publishing operations. Ordinary community operations
must use verified user tokens plus AgentGrid RLS, rather than service-role writes.
Shared infrastructure increases the impact of a privileged-key compromise and
shares capacity/failure risk; it does not provide separate-project isolation.

## Extraction runbook requirements

Before extraction, rehearse these steps on an isolated target:

1. Create an independently authorized Supabase project and apply only AgentGrid migrations.
2. Recreate AgentGrid policies, functions, buckets and environment configuration.
3. Export only `agentgrid_*` data and assets; retain checksums and a timestamped backup.
4. Inventory AgentGrid auth users through the private `agentgrid_identities` link,
   not all shared users. Creator/business profile IDs are independent of Auth IDs.
   Choose a documented Supabase Auth migration/reassociation strategy; preserve
   Auth UUIDs where supported or remap only those private identity links deliberately;
   include any deliberately retained `agentgrid_onboarding_pilots.user_id` links
   in that reassociation. Normally retire expired admission records before export;
   do not enroll unrelated shared users or renew pilot expiration during migration.
   profile IDs and agent ownership stay stable. Validate Google identity
   linking and require reauthentication when signing keys change. Do not assume
   old sessions or refresh tokens remain portable.
5. Import data in FK order, preserve immutable-version checksums and fork lineage,
   copy assets, and validate counts, ownership and the full RLS matrix.
6. Freeze AgentGrid mutations briefly or capture/replay an explicit delta. Verify
   publication freshness and backups before switching environment configuration.
7. Test real email/Google login, creator flows, saves/reviews/forks/moderation,
   asset URLs, publishing and rollback on the new project.
8. Cut over, monitor, and keep the old AgentGrid resources during the rollback window.
9. Remove old AgentGrid resources only after successful validation and explicit
   owner approval. Never delete shared auth users or PicMagic resources as cleanup.

The application must access storage, auth and database through an AgentGrid service
layer parameterized by environment configuration. Components must not embed the
current project reference or rely on undocumented project state.

## Reproducible local database acceptance

`pnpm test:database` creates a fresh database inside a separately labelled,
network-isolated disposable container using a digest-pinned Supabase PostgreSQL
17.6 image. It accepts no connection string, creates no public port, mounts no
existing volume and uses synthetic data only. It applies every migration in
order and records the source checksum transactionally in AgentGrid's own history.
The RLS/RPC matrix then runs against owner, other member, moderator, administrator,
suspended member, anonymous and shared-auth non-member identities. Protected
fixture schema, grants, policies, functions, triggers and rows must be unchanged.
Only the exact container created by that invocation can be cleaned up. Existing
PicMagic containers and databases are never targets. CI runs the same acceptance
command. This complements the real read-only project guard; synthetic fixtures
do not prove every detail of a remote project's configuration.

The same runner also creates an independent synthetic source and target, exports
only the explicit `agentgrid_*` application-table allowlist with `pg_dump`, and
imports it transactionally after remapping just the private Auth links. Owned FKs
are deferrable **initially immediate**, retaining normal runtime semantics while
supporting atomic configuration/fork references and identity reassociation. It
compares every restored row, private draft, review/report state, immutable bundle
digest and lineage and checks protected fixtures on both sides. A reassociated
user retains the same business profile/authority without rewriting ownership IDs.
Both databases and all synthetic identities disappear with the owned container.
This is a data/identity-link rehearsal, not a GoTrue password/provider migration;
real email/Google identities, sessions, assets and cutover still need the deliberate
managed-Auth strategy and acceptance steps above.

The private identity table and short-lived onboarding pilot table reference managed
`auth.users`; application ownership and roles reference stable AgentGrid profiles.
AgentGrid never deletes a shared Auth user. If another application deletes that
identity, an AgentGrid-owned trigger detaches the private link and deactivates and
deidentifies its profile without deleting immutable creator records or blocking
the managed deletion. Reserved pseudonymous handles encode the complete profile
UUID to avoid deletion-blocking collisions. Product account deletion, retention,
reports and published attribution need their own tested policy before launch.

### Controlled onboarding before public registration

Migration 029 adds `agentgrid_onboarding_pilots`, initially empty, without enabling
global registration or creating profiles. A private managed-identity UUID and an
expiration of at most 14 days permit the two existing authenticated onboarding
RPCs to admit that caller. Missing current legal versions, expired enrollment and
unlisted users remain denied even when bypassing the HTTP staging pilot. The
database clock enforces expiry without depending on a scheduled cleanup task.
The table and internal eligibility helper have no anonymous, member or service-role
grant; moderator/administrator application roles cannot enroll additional users.
This is admission only: no consent, public visibility, staff role or package
ownership is inferred from enrollment. Existing members retain their membership
after an admission record expires or is revoked.

Before enrolling the real owner, inspect the verified managed identity, configure
the deployed legal versions, retain global registration as false, and record the
exact expiry privately. Consent must still be explicitly accepted in the UI.
Public registration remains gated on contact delivery, retention operations and
real community journey acceptance. Do not use the pilot as a permanent membership
allowlist or as a substitute for RLS. Remove expired admission rows during the
approved owned-data retention process; never remove shared Auth identities.

### Applied foundation and read-boundary verification

The six foundation migrations were applied from clean exact main commit
`509a69f0c65ee805827fbaf6bce781b42962d264` after successful exact-commit CI.
Protected fingerprints passed between every transaction. The original baseline
was not replaced. No application users, drafts or public activity were seeded.

`python3 scripts/verify-shared-agentgrid-boundaries.py` rechecks installed history
and protected state, then uses transaction-local synthetic anonymous/non-member
claims under PostgreSQL read-only enforcement. It verifies that no membership,
private identity read or privileged publication grant is acquired. It is operator
acceptance evidence, not a replacement for actual JWT/account E2E in Phase 4.

The local database runner reuses an exact-digest cached image. A cold CI pull may
use the official Supabase Docker Hub mirror when public ECR is unavailable or
rate-limited; both references resolve to the same verified OCI manifest digest,
never a floating tag. If both fail, database acceptance fails rather than skipping
checks. Disposable cleanup verifies the actual selected pinned image as well as
container identity, purpose label and network isolation.

The offline extraction rehearsal suppresses **only AgentGrid-owned user triggers
on the new disposable target** during import, so publication counters and other
side effects do not rewrite restored data. Foreign-key constraints remain enabled,
are deliberately deferred, then checked immediately after identity reassociation.
Owned user triggers are re-enabled before committing; an explicit post-import check
rejects any disabled trigger. Never run this import procedure on the shared source,
on a live target, or with a broader table/trigger allowlist.
