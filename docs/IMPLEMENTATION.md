# AgentGrid implementation ledger

The approved specification is authoritative. This ledger records evidence rather
than treating existing code as completed functionality.

## Phase gates

| Phase                            | Status      | Exit evidence                                                                                                                                                                         |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Ownership and infrastructure | Validated   | Personal ownership/CI, free Cloudflare exact-commit delivery, protected Supabase baseline, real email OTP and Google PKCE sign-in; unpublished previews restricted to local loopback. |
| 1 — Contracts and content        | Validated   | Portable/editorial gates, six isolated migrations, protected remote rollout, owned-data extraction and ten broad representative drafts; full host-tested inventory remains Phase 6    |
| 2 — Visual system                | Not started | Desktop/mobile browser inspection and iteration; accessibility and performance evidence                                                                                               |
| 3 — Public discovery             | Not started | Search evaluation; distribution E2E; crawlable public HTML                                                                                                                            |
| 4 — Identity/workspace           | Not started | Google and real email OTP; cross-account isolation; live saves/drafts                                                                                                                 |
| 5 — Community                    | Not started | Full moderation/version/fork/review/report journeys                                                                                                                                   |
| 6 — Publishing/inventory         | Not started | Failure recovery; broad tested inventory; no private-data leakage                                                                                                                     |
| 7 — Hardening                    | Not started | Restore/rollback; browser/a11y/performance/security audits                                                                                                                            |
| 8 — Production launch            | Not started | Domain, webmaster setup, production journeys and monitoring                                                                                                                           |

## Product invariants

- Full community V1; no placeholder success flows.
- 36 quality-gated packages minimum; target 75–100 if the quality bar is met.
- Broad consumer coverage; no artificial directory-count goal.
- No fabricated popularity, community activity, creators, or testing claims.
- No paid activation, recharge, or billable add-on without explicit approval.
- Private application source; explicit package licenses, including community choices.
- Live community interactions are distinct from batch-published SEO content.
- Visual acceptance requires browser review and iteration, not specification compliance alone.
- No commit or push under a work identity. Never change global Git configuration.
- PicMagic's Supabase project is shared physical infrastructure only. Every
  AgentGrid-owned database/storage resource uses `agentgrid_`; non-AgentGrid
  resources and existing global auth behavior are protected.
- AgentGrid migrations must recreate its backend in a clean project. Application
  data may reference shared `auth.users`, never PicMagic application tables.
- Project extraction requires a deliberate auth-user migration, asset copy,
  validation/cutover, and explicit approval before removing old resources.

## Phase 0 evidence — 7 October 2026

- Private repository: https://github.com/devujjwal/agentgrid.
- Local formatting, lint, strict typecheck, 3 boundary tests, and production static export pass.
- Remote CI passed at `f7f80ad`:
  https://github.com/devujjwal/agentgrid/actions/runs/37575180458.
- Global Git configuration baseline unchanged; every commit uses the personal identity.
- No production deployment or paid service activated.
- Production dependency audit found no advisories. Full development dependency audit
  found a documented lint-only advisory; see the operations security assessment.
- Phase 0 remains gated on real authentication delivery and deployment authorization.

## Phase 0 provider validation — continued

- Cloudflare personal account email verified. Static proof deployed to
  https://agentgrid-infrastructure.pages.dev without enabling billing or Git
  automatic deployments. This is an infrastructure test, not the launch site.
- HTTPS GET returns 200, an unknown route returns 404, robots excludes all
  crawlers, and the response sends CSP, noindex, nosniff, frame-denial and
  permissions headers. Chrome renders the expected proof page.
- Supabase connectivity verified using existing personal CLI authorization.
  No project, schema, bucket, auth setting, policy, function, or data changed.
- No `agentgrid_` collisions found. Protected public/private application schema,
  storage policies/buckets, functions, triggers, columns, constraints, indexes and
  ACLs recorded privately. Repeated audit detects no changes.
- PostgreSQL-enforced read-only checks under `anon` and a synthetic
  `authenticated` identity deny PicMagic private prompts/articles/collections and
  admin roles. This is initial evidence, not a substitute for the full AgentGrid
  owner/other-user/moderator/admin matrix in Phase 1.
- Shared auth Site URL/callbacks are PicMagic's. Google is disabled and custom SMTP
  is unset. These settings remain untouched. AgentGrid email delivery will use its
  own server-side adapter so PicMagic SMTP/templates do not need modification.
- Resend dashboard confirms Free, 3,000 emails/month, 100/day, initially 1/3 domain
  slots used, and pay-as-you-go disabled. Existing keys/domain remain untouched.
- Personal Google Cloud sign-in completed. Separate `AgentGrid` project
  `agentgrid-510905` created; billing page explicitly confirms no billing account.
  OAuth branding created in External testing mode; the owner approved the required
  user-data policy and the dashboard confirms configuration creation. The web
  client form is prepared with only the Supabase callback. Its separate persistent
  credential/configuration authorization is pending; no client credential issued.
- Owner authorized the three additive email DNS records and restricted Resend key.
  GoDaddy shows all additions saved; authoritative DNS returns the exact records.
  Resend verifies `mail.agentgrid.me`. Receiving remains off and TLS is enforced.
  New `agentgrid_transactional` key has Sending access to that domain only; it is
  stored in ignored local configuration with mode 0600. Nothing is billable-enabled.
- Server-only email adapter validates sender/input, uses an opaque idempotency key,
  refuses redirects, bounds request time, and discards sensitive provider errors.
  Static application imports from the backend are forbidden by lint.
- Live owner-alias OTP check: receipt `01a114f3-8224-7481-a1e9-3024741646c9`
  reports Delivered in Resend. Real Supabase OTP verification, replay rejection and
  local-only sign-out pass. No public profile/activity was created. Existing
  managed Supabase keys were read into private local configuration only, with no
  credential creation/rotation or Cloudflare transmission.
- Returning-user check also passes, with receipt
  `01a114f6-2dc4-7f22-93d8-790c360107ab`. Updated local acceptance: formatting,
  lint, strict typecheck, 10 automated tests, production build and secret-loaded
  export inspection pass. Production dependency audit reports no advisories.
- Post-delivery audit confirms protected schema/shared auth configuration unchanged
  and repeats successful anonymous/authenticated PicMagic private-data denial checks.
- This validates provider interoperability, not the complete public sign-in flow.
  Application challenge expiry, abuse limits, session/CSRF protections, Google
  login and cross-account journeys remain acceptance requirements. Shared provider
  OTP expiry remains 3,600 seconds; do not claim a shorter application expiry yet.
- Remote CI passes at `b6fd4d5`:
  https://github.com/devujjwal/agentgrid/actions/runs/37577025508.
- At this point Google login remained pending; the subsequent evidence below
  records its authorized setup and completed provider proof.

## Phase 0 Google interoperability — verified

- Owner approved Google OAuth setup. Created the `AgentGrid web sign-in` client
  in the separate, unbilled AgentGrid Google project. Provider redirect is exactly
  `https://lxecbrvzpmgjmsqiachc.supabase.co/auth/v1/callback`; no unrelated Google
  project or credential was modified. Private local credentials use mode 0600.
- Enabled Google in Supabase and added only the exact local AgentGrid callback
  `http://localhost:3027/auth/callback/`. Existing PicMagic Site URL, callbacks,
  email/SMTP/templates and every other auth field are unchanged.
- Original protected baseline remains intact. An independent private transition
  record binds the exact approved four-field delta to before/after fingerprints.
  Supabase's management response represents the secret opaquely; recording that
  observation is distinct from the real credential interoperability test.
- Google testing audience contains only the owner. Real Chrome sign-in passed:
  PKCE exchange, server-verified Google identity and local-only sign-out. Scopes
  are identity/email/basic profile; no Gmail/Drive or offline access was requested.
  No public profile, review, activity or popularity was seeded.
- Post-change schema/permission inventory and anonymous/authenticated PicMagic
  private-data denial checks pass. Offline tests reject unrecorded auth changes,
  unrelated settings, broader callbacks and mismatched projects.
- Local proof regressions cover host/Origin/CSRF validation, single-use callbacks,
  verified identity, local sign-out, safe redirects and redacted failure behavior.
  Browser testing corrected same-origin referrer/form redirect policies in the
  localhost-only harness. This harness is not a production authentication route.
- Formatting, lint, strict typecheck, 16 automated tests and production build pass.
  Export inspection with privileged configuration loaded detects no leaked values;
  production dependency audit reports no known advisories. Personal Git identity
  and the unchanged global work configuration are independently verified.
- Google remains External/Testing. Public branding, policy URLs, domain readiness
  and production callbacks are required before launch. Public auth, account linking,
  application expiry/abuse protection and cross-account journeys remain Phase 4 gates.
- CI-gated release credentials/workflow and private preview access remain Phase 0
  gates. Product, community, visual and launch gates are not claimed as complete.

## Phase 0 release control — verified

- Exact OAuth milestone `346be06747354cd370726cf04b1b78607c587a7c` passed GitHub CI:
  https://github.com/devujjwal/agentgrid/actions/runs/37582038758.
- Owner approved the separately reviewed expiring account-owned Cloudflare token.
  Pages Write is its only permission; no DNS/billing access or paid activation.
  Provider verifies it as active, and the existing infrastructure project has
  main as production branch and only its pages.dev domain. Credentials are stored
  privately and in encrypted secrets in the verified private personal repository.
- A guarded manual release workflow and pinned deployment CLI are implemented.
  Local formatting, lint, strict typecheck, 18 tests, build and secret-loaded export
  inspection passed before the additional dependency gate described below.
- Unpublished previews remain local; no private draft resource is uploaded.
  Authenticated live workspace preview access must be tested in Phase 4 before
  enabling remote private previews. Product publishing remains a separate gate.
- Expanded deployment-tool audit found a patched `sharp` vulnerability. Applied
  the narrow Miniflare override before deploying; full-tree CI now permits only
  the documented exact unpatched lint exception and rejects unassessed findings.
  Updated formatting/lint/typecheck, 20 tests, build and secret-loaded export pass.
- Exact commit `4109c15f65cfdce0e38024c1be0f8692d0bfea1c` passed both Validate CI
  https://github.com/devujjwal/agentgrid/actions/runs/37582837597
  and the real manually dispatched infrastructure release
  https://github.com/devujjwal/agentgrid/actions/runs/37582862775.
  Provider receipt/readback confirm production/main and the same commit.
  HTTPS content, CSP/nosniff/noindex, robots exclusion and true 404 checks pass.
  Chrome visibly renders the expected public proof; no product or private draft
  content was deployed, and the production domain remains parked.
- Foundation preview policy is enforced conservatively: local loopback development,
  no branch/PR remote deployments, and the remote workflow accepts only the noindex
  infrastructure destination. Authenticated workspace previews and product public
  publishing still require their later functional/security gates.
- Phase 0 is validated for its infrastructure scope. Public sign-in UX, Google
  production branding, application authorization and launch readiness remain later
  acceptance work. No paid plan, recharge, billing permission or add-on was enabled.

## Phase 1 portable contract and identity foundation

- Versioned strict specification rejects ownership/moderation spoofing, unsafe
  extensions, ambiguous automation/import claims, inconsistent licenses and
  unconfirmed writes. One substantive inbox-triage draft exercises the contract;
  it is unlicensed, unpublished and explicitly not real-host verified.
- The first AgentGrid migration creates only prefixed identity/configuration/role
  and bounded quota resources. Profile IDs are independent of shared Auth IDs.
  The private identity link supports explicit onboarding and future reassociation;
  managed identity deletion deactivates/deidentifies the profile without deleting
  its stable business ID. No managed auth trigger or protected table is altered.
- `pnpm test:database` recreates the migration in a pinned, disposable local
  Supabase PostgreSQL container and tests anonymous, owner, other member,
  moderator, administrator, suspended member and shared-auth non-member access.
  Forged metadata cannot create roles; quota bypass and protected application
  writes/RPC calls are denied. A limited synthetic Auth administrator can delete
  an identity without AgentGrid privileges, and its old JWT loses membership.
- Database tests and protected fixture/default-grant fingerprints pass. Formatting,
  lint, strict typecheck, 26 automated Node/Python tests and static production
  build pass. Localhost tests require loopback access; the filesystem sandbox's
  denied bind was resolved by running that authorized test harness outside it.
- No AgentGrid schema or data has been applied to the shared remote project.
  Immutable agent versions, editorial/publication gates and community schemas
  remain work in progress; Phase 1 is not yet accepted.

## Phase 1 resource/community data boundaries — local acceptance

- Five reproducible migrations now cover identities, normalized category/platform
  vocabulary, private revisioned drafts, immutable spec/editorial versions,
  submissions/live releases, licensing/fork lineage, saves, moderated reviews,
  confidential reporting, append-only moderation history, staff governance and
  exact public projections. No PicMagic application table is referenced.
- Database actor matrices pass for resource creation, stale saves/submissions,
  version immutability/monotonicity, unauthorized approval, source license
  retention, unpublished content denial, private saved lists, review edit
  invalidation, real-record aggregates, duplicate reports and staff decisions.
- Public projections keep quality artifacts, consent/Auth links, staff roles and
  private draft/review reasons out of public output. Only the configured genuine
  owner can receive first-party attribution. Blocked source instructions stay
  private while independent licensed forks retain minimal source lineage;
  managed deletion produces a deidentified attribution tombstone.
- Staff checks apply immediately to existing JWTs. Last-admin protection covers
  AgentGrid-controlled changes but does not block external managed Auth deletion.
  Explicit AgentGrid deactivation removes private drafts/saves and archives/hides
  live resources while preserving shared identities and immutable retention records.
- The publication gate binds actual current host artifacts to the exact portable
  specification, requires all three scenarios per declared platform, rejects
  failed/illustrative/mismatched evidence and credentials, and verifies owned JSON
  artifact bytes/checksums. Editorial context, source checks, rights, related
  links and broad inventory coverage are core contracts, not late SEO additions.
- Latest acceptance: 32 Node/Python tests, formatting/lint/strict typecheck and
  production export pass. All five migration matrices pass in a fresh pinned
  local database and leave protected synthetic schema/data/default grants unchanged.
  Initial identity CI also passed:
  https://github.com/devujjwal/agentgrid/actions/runs/37586076829.
- A fresh real read-only Supabase audit confirms protected resources unchanged,
  with only the separately recorded approved Google config transition. Anonymous
  and ordinary authenticated PicMagic denial checks still pass.
- These are backend **contract/database** results. HTTP auth/abuse protections,
  asset delivery, creator UI, actual host-tested inventory, public/static takedown,
  operator recovery and production community journeys remain unimplemented gates.
  No schema, test release, fake review/profile or application data has been written
  to the remote shared project. Phase 1 remains in progress.

## Phase 1 extraction rehearsal

- A sixth owned-only migration makes application FKs deferrable, initially
  immediate; normal runtime behavior is preserved. CI verifies that references
  stay within AgentGrid or managed Auth, RLS remains enabled, function search
  paths are confined and direct mutation grants stay restricted.
- Independent synthetic source/target databases exercise actual `pg_dump`/COPY
  of the owned application allowlist. Target managed Auth UUIDs differ; only the
  private identity links are reassociated. Business IDs, drafts, roles, saves,
  review/report state, immutable digests, release pointers and fork lineage match
  exactly after import. Protected application fixtures/default grants are unchanged.
- The reassociated identity retains its original profile and database authority.
  Six migrations, all actor matrices and extraction acceptance pass locally.
  Database readiness waits for final startup, and owned temporary containers are
  removed only after exact identity/label/network checks. Other application
  containers and data were not targets.
- This validates owned-data portability. Managed provider/password migration,
  real reauthentication, asset copying and production cutover remain explicit
  future extraction tasks; the shared remote project still has no AgentGrid DDL.

## Phase 1 foundation acceptance — 7 October 2026

- Exact branch CI passed at `ed5d0ce546af181f04104add8bf50146e811f367`:
  https://github.com/devujjwal/agentgrid/actions/runs/37591912908.
  Private foundation PR 1 was merged preserving its logical milestone commits.
  Merge commit `509a69f0c65ee805827fbaf6bce781b42962d264` passed its own Validate run:
  https://github.com/devujjwal/agentgrid/actions/runs/37592289012.
- The guarded operator applied all six exact-checksum migrations to the authorized
  shared project. Protected schema, policies, storage, grants and auth configuration
  fingerprints passed before/after every additive transaction. Original baselines
  remain intact, and private operator records bind owned schema to migration history.
- Live read-only checks under anonymous and a synthetic non-member authenticated
  role deny private identity and privileged publication access. The shared identity
  acquires no profile, staff role or saved list. No public profile, rating, review,
  activity or application fixture was seeded. Real-account E2E remains later work.
- Ten substantial task-specific drafts now cover every approved launch category,
  with normal, ambiguous and adversarial examples. They remain unpublished,
  unlicensed and explicitly unverified on real hosts. They are authoring examples,
  not the 36-resource launch gate. See `CONTENT_STRATEGY.md` for editorial work.
- Formatting, lint, strict typecheck, 36 Node/Python tests and production static
  export pass. Database matrices/extraction passed on the unchanged migration
  sources and exact merge commit in CI. The content milestone changes no schema.
- Phase 1 is accepted for contracts, schema isolation, reproducibility and broad
  representative authoring. It does not claim complete HTTP/community functionality,
  distribution UX, production Auth, actual host-tested inventory or launch readiness.
  Phase 2 will develop and iterate the visual system through desktop/mobile browser
  review; the production domain remains parked and the public proof unchanged.
