# AgentGrid implementation ledger

The approved specification is authoritative. This ledger records evidence rather
than treating existing code as completed functionality.

## Phase gates

| Phase                            | Status      | Exit evidence                                                                                                                                                                         |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 — Ownership and infrastructure | Validated   | Personal ownership/CI, free Cloudflare exact-commit delivery, protected Supabase baseline, real email OTP and Google PKCE sign-in; unpublished previews restricted to local loopback. |
| 1 — Contracts and content        | Validated   | Portable/editorial gates, six isolated migrations, protected remote rollout, owned-data extraction and ten broad representative drafts; full host-tested inventory remains Phase 6    |
| 2 — Visual system                | Validated   | Desktop/mobile browser inspection and iteration; accessibility and performance evidence                                                                                               |
| 3 — Public discovery             | In progress | Search evaluation; distribution E2E; crawlable public HTML                                                                                                                            |
| 4 — Identity/workspace           | In progress | Real owner sign-in/logout; saved-list boundary; synthetic creator CRUD/history/reauthentication, responsive and signed-in lab checks; real member/submission gates remain open        |
| 5 — Community                    | In progress | Private reporting boundary and responsive recovery; full moderation/fork/review journeys remain open                                                                                  |
| 6 — Publishing/inventory         | In progress | Private host evidence and reviewed release boundary validated; static capture/takedown and broad real host-tested inventory remain open                                               |
| 7 — Hardening                    | In progress | Static script policy and local negative browser checks; provider verification, restore/rollback and full cross-browser audits remain open                                             |
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

## Phase 2 visual acceptance — local evidence

- Implemented a bounded, lazy SVG network, semantic task command, native filters,
  factual resource inspector and list with a warm paper/ink identity. No runtime
  animation/font library, WebGL or fabricated community activity is introduced.
- Chrome review and iterations cover 320/393/768/1024/1440px, keyboard search,
  empty/reset/filter/selection flows and real reduced-motion emulation. See
  `VISUAL_SYSTEM.md` for corrections, measurements and their limits.
- Optimized local lab runs measure 99 mobile / 100 desktop performance, 100
  accessibility and 100 best practices, with zero layout shift. The intentionally
  nonindexable preview is not a production SEO or field-INP acceptance claim.
- The preview is loopback-only in a separate ignored export directory. Normal
  builds and CI cannot publish its drafts. Exact-head CI passed at `09322de368fb8274ef735e822410c3bb1a658ba4`:
  https://github.com/devujjwal/agentgrid/actions/runs/37597306397.
  PR 3 merged preserving both milestones (`10900d6`); Phase 2 is accepted. Full launch content, distribution,
  community, cross-browser and production quality checks remain outstanding.

## Phase 3 discovery/distribution foundation — local acceptance

- Static detail pages, strict released-only projections, crawlable result links,
  factual structured information and a released-only sitemap are implemented.
  The asynchronous search adapter is bounded, paginated and ready for a future
  remote provider; launch ranking remains deterministic and free.
- Clipboard and downloaded definitions retain source, creator and license terms.
  Real browser checks use a clearly labelled local synthetic fixture; no test
  release, creator, review or host activity enters the shared project or catalogue.
- Draft/QA export isolation removes generated not-found artifacts and refuses
  unexpected content/symlinks. Production inventory remains empty. Workflow
  delivery fails closed until the owned artifact transport is validated.
- See `DISCOVERY_ACCEPTANCE.md` for browser iterations, query cases, measurements
  and limitations. Local discovery is a validated foundation; its real published
  E2E and editorial-route/indexing gates remain open for Phase 6 dependencies.
  Phase 3 is not claimed as fully complete, and the production domain stays parked.
- Final local checks pass: formatting, lint, typecheck, all 50 automated tests,
  production build and secret-loaded export inspection. Updated mobile lab runs
  retain 99 performance / 100 accessibility / 100 best practices, with zero CLS:
  discovery LCP 2.05s/TBT 35ms and detail LCP 2.04s/TBT 26ms. SEO remains
  intentionally noindex; field INP and production cross-browser acceptance are open.

## Phase 3 private CI integration

- Exact discovery head `e33166caeaad85160ab8bf9033206a15b2a9901d` passed Validate,
  including database isolation/extraction:
  https://github.com/devujjwal/agentgrid/actions/runs/37602360838.
  Private PR 4 merged preserving its two logical commits (`690e24a`).
- Integrated real publishing and editorial/indexing gates remain open. No product
  deployment, invented community data or license selection accompanied this merge.

## Phase 4 identity/workspace boundary — local implementation

- Implemented encrypted flows and provider-session state, single-use browser-bound
  email/Google verification, exact-origin CSRF, opaque HttpOnly sessions, safe
  redirects, redacted private responses and user-bearer workspace operations.
- Two additive migrations provide bounded owned ephemeral state and a
  self-only live identity/consent projection. Eight-migration database tests pass,
  preserving protected fixtures/default grants and owned-data extraction checks.
- Tests caught a microsecond expiry-constraint race; creation and expiry now share
  one timestamp. Refresh race tests verify convergence and prevent session
  resurrection after logout. No managed Auth or protected application DDL changes.
- Sign-in/workspace screens are being integrated and reviewed in Chrome. Profile
  onboarding is still closed; no actual consent, profile, role or activity is seeded.
- See `IDENTITY_ACCEPTANCE.md` for bounds, evidence and remaining gates. Phase 4
  is not complete, and live server credentials have not been deployed.

## Phase 4 real identity acceptance — continued

- Private PR 5's exact head `c03fa2c` passed CI; merge `e141345` also passed
  https://github.com/devujjwal/agentgrid/actions/runs/37608333640.
  The guarded operator applied migrations 007/008 with protected fingerprints
  unchanged before/after each transaction. Eight migrations are now recorded.
- The actual application Google and email-code flows reach the remote-verified
  private workspace on localhost. Live testing caught opaque provider-shape
  assumptions (12-character refresh tokens and 56-character email hashes);
  corrections have regression tests and preserve remote verification.
- Logout removes private React/session state; direct access subsequently shows
  the sign-in gate. No creator profile, legal consent or social activity is seeded.
- Compiled workerd acceptance now exercises secure cookie encryption round-trips,
  origin/CSRF denial, callback routing and private workspace denial with synthetic
  keys and forbidden outbound traffic. This is independent of provider proof and
  is not a deployment/CPU-limit claim.
- Signed-in workspace measurements at 320/393/768/1024/1440px confirm no overflow
  and a 48px logout control. Full authoring, saved-list and profile journeys are
  still required before Phase 4 acceptance.

## Phase 4 saved-resource rollout and creator authoring — continued

- Private PR 7 passed exact-head CI (run `37612178073`) and merged at
  `36f5f2b43a61a77cff5c5edc9c02883114448aa8`. Its exact-main CI also passed.
  The guarded operator applied migration 009 from that commit. Nine owned
  migrations are now recorded; protected shared resources were unchanged.
- Creator authoring is implemented behind verified identity, current active
  membership, explicit ownership and revision checks. Guided private definitions
  cover purpose, behavior, inputs/outputs, platforms, access, examples, safety
  and deliberate reuse terms. They do not infer host compatibility or licenses.
- Portable import/download is bounded and retains resource paths/source terms.
  Definition readiness is separate from editorial approval and genuine host-test
  evidence. Saving never publishes a resource.
- Local automated acceptance passes private draft validation, denied ownership,
  race/acknowledgement handling, bounded projections and origin/CSRF checks.
  Production static export and compiled workerd acceptance pass without provider
  traffic. See `IDENTITY_ACCEPTANCE.md` for browser evidence and remaining gates.
- Authoring is **not accepted as complete**. Session restoration, creation/save,
  profile editing, full responsive/a11y checks and private CI remain required.
  Registration remains closed pending the legal operator information and reviewed
  consent documents. No genuine creator profile or invented activity was seeded.

## Phase 4 immutable submission/history — local acceptance

- Private saved drafts now submit immutable versions through verified user-bearer
  RPCs with explicit creator ownership, complete portable definitions, selected
  use terms, revision checks, a single pending request and increasing versions.
- Live private history distinguishes saving, review and publication; cancellation,
  withdrawal, version advancement and unchanged frozen content pass disposable
  browser acceptance. On-demand definition inspection/download excludes editorial
  evidence and preserves rights/lineage. Long-history paging retains keyboard
  focus and enforces pending/version gates independently of the displayed page.
- Responsive snapshot checks and signed-in mobile lab pass: performance 98,
  accessibility 100, LCP 2.35s, CLS 0.005. Full formatting/lint/typecheck, 71 Node
  and 11 Python tests, production export and compiled worker acceptance pass.
  Eleven-migration actor/isolation/extraction acceptance passes locally.
- See `IDENTITY_ACCEPTANCE.md` for evidence boundaries. Private CI and exact-main
  migration 010/011 rollout remain pending; real member/community journeys,
  inherited fork rights and legal/consent acceptance remain open. Phase 4 stays
  in progress and no new production deployment or public content is claimed.

## Phase 4 submission rollout — continued

- PR 9 exact-head CI `37639656153` passed at `e372645` and merged as
  `f2ba23a3134d90925a79d1ea293688f9032e7052`. Exact-main CI `37639981912`
  passed, including the eleven-migration actor/isolation/extraction suite.
- The guarded operator applied additive migrations 010/011 from that clean
  exact main commit. Protected fingerprints remained unchanged around every
  transaction; eleven known migrations are now recorded. Anonymous/shared
  non-member read-only boundaries pass. No actual member, draft or public
  community activity was seeded, and no production app deployment occurred.
- Real consent/member journeys remain a Phase 4 gate. Independent community
  boundary work continues while registration stays closed.

## Phase 5 private reporting — local acceptance

- Agent/review/profile concerns use verified user-bearer authority, exact-origin
  CSRF, bounded plain-text fields, database target checks, duplicate-open
  protection and per-member quotas. Acknowledgements require the exact self-owned
  report target/content; missing confirmation never claims a failed write.
- Additive migration 012 provides reporter-only live status/history with bounded
  lookahead. Staff cannot use this creator endpoint to broaden its ownership
  filter. It joins no protected PicMagic resources or private identity details.
- Reporting loads on deliberate interaction. Tab-held explanations survive
  internal history, require fresh identity/membership before rendering, and
  never enter persistent browser storage. Successful sign-out explicitly clears
  held state; unsaved edits require a discard confirmation before logout.
- Disposable Chrome acceptance passes anonymous gating, actual send/receipt,
  live history/resolution, uncertain acknowledgement recovery, duplicate-open
  refusal, retained text/fresh permission after history, suspension concealment,
  refresh focus, and native sign-out cancellation/confirmation. No fixture is
  written to Supabase, indexed or deployed.
- 320/393/768/1024/1440px history checks show no overflow; refresh exceeds 48px.
  Signed-in mobile lab: performance 98, accessibility 100, best practices 96;
  LCP 2.342s, TBT 26ms, CLS 0.00293, no console errors. Private-route SEO 63
  is intentional. Known inline-script CSP hardening remains a launch gate;
  the lab does not establish field INP or real provider latency.
- Formatting/lint/strict typecheck, 75 Node/11 Python tests, production static
  export and the 770,548-byte compiled worker pass. Twelve disposable migrations
  pass actor denial, protected fixtures and extraction/reassociation. Private CI passed on reporting PR10 head `87fb404` (run `37642748073`)
  and merge/main `00e5f9a` (run `37643652417`). Migration 012 was applied
  from that clean exact main commit. Protected fingerprints remained unchanged
  around its transaction; read-only anonymous/nonmember owner-history denial
  and shared-project checks passed afterward. Twelve migrations are remote.
  Full community
  acceptance still requires reviews/ratings, public forks, staff moderation,
  real membership/consent and production journeys. Registration remains closed.

## Phase 5 reviews and ratings — validation in progress

- Live anonymous review reads and verified member writes are implemented with
  strict data projections, current eligibility, private owner recovery, explicit
  used-version selection and database-backed revision/withdrawal authority.
  Migration 013 is local only; twelve migrations remain applied remotely.
- Public review code loads near the viewport and identity/editor code on intent.
  The editorial layout preserves actual moderation states and counts, keeps held
  edits in tab memory, and uses accessible in-page confirmations. Unsure write
  acknowledgements require a live recovery check before retry.
- Local actor/isolation/extraction, 82 Node/11 Python tests, typecheck/lint/format,
  static export and compiled worker acceptance pass. Mobile reader/editor lab
  scores reach 99 performance and 100 accessibility with CLS 0; the empty-reader
  LCP sample of 2.568s remains recorded alongside populated/editor samples near
  2.26s. Actual editor widths 320/768/1024/1440px show no overflow.
- See `IDENTITY_ACCEPTANCE.md` for tested browser scenarios and evidence limits.
  Final sign-out/dialog recovery, private CI and exact-main migration rollout
  remain open. Full community and production launch are not yet accepted.

### Review browser gate resolved

The replacement sign-out dialog now passes cancellation, focus restoration,
confirmed logout, anonymous history concealment and discarded-review recovery.
Reconnection returns the saved title only. PR11's implementation head passed
CI run `37668163054`, including all thirteen disposable migrations. Continue
through final-head/main CI and guarded additive rollout before the next
community increment; no production app deployment is implied.

### Reviews rollout verified

PR11 final head `5c2003e6232f01e608b03847963d45f09b11bfb9` passed CI
`37670449600` and merged as `73383f2db8159a88969c2c0d44075ce8af4812f2`.
Exact-main CI `37670758731` passed. The guarded operator applied migration
013 from clean exact main; protected fingerprints remained unchanged. The
post-rollout anonymous/nonmember checks passed without creating application rows.
Thirteen migrations are applied remotely; no production application deployment
or public review activity is implied.

### Staff review moderation — local acceptance

The private staff queue and inspection/decision interface now use active
AgentGrid roles and verified user-bearer RPCs. Migration 014 adds a separate
moderation revision and quota; both content and decision revisions must match.
The legacy direct decision RPC loses client execution privileges, preserving
its internal audit and self-review/withdrawal/publication guards. No actual role
is granted. Protected resources and existing profile quota actions are retained.

Local fourteen-migration actor/isolation/extraction tests, 86 Node/11 Python
tests, lint/typecheck/format and production export pass. The 782,073-byte worker
passes compiled routing/session/CSRF/denial checks, including the staff endpoint.
Browser acceptance covers anonymous/member denial, 20+3 pagination with focus,
confirmation cancellation, actual decision receipt, stale staff conflict,
uncertain acknowledgement recovery, self-review refusal, role revocation,
withdrawal, navigation retention and sign-out clearing after reconnection.

Mobile staff queue lab: performance 97, accessibility 100, best practices 96;
LCP 2.356s, TBT 45.5ms, CLS 0.0613. Private noindex SEO 63 is intentional;
CSP hardening remains open. Responsive widths 320/768/1024/1440 have no overflow,
and choice controls are 48px. These are synthetic loopback results, not production
latency or field INP. Staff moderation of reports/submissions and public forks
remain separate implementation gates. Migration 014 is not yet applied remotely.

### Staff review CI gate

PR12 final head `7a95e8761d5856048c7b03e7c67a2d004ac243fc` passed CI
`37673399890`; merge/main `689f0d78bbef4d059d06b4a94b00bc49a40ee9d8`
passed `37674118430`. Migration 014 remains pending guarded rollout alongside
015 after the next exact-main gate.

### Staff report investigation — local acceptance

Migration 015 captures immutable, staff-only evidence when an agent, review or
profile concern is submitted. Existing reports are not retroactively assigned
invented snapshots. Queue summaries omit confidential prose and identity; detail
and decision endpoints require active AgentGrid staff and verified bearer
permissions. Reporter/target-owner conflicts cannot resolve their own reports.
Closing an open concern records an immutable audit entry and the reporter-facing
response; it does not silently perform a resource takedown.

The private UI supports bounded live queues, captured evidence, explicit outcome
confirmation, stale-closure refusal, uncertain-write recovery, and tab-held
response notes. Browser acceptance passes cancellation/focus, actual receipt,
competing closure, lost acknowledgement, involved-moderator denial, absent legacy
capture, plaintext review markup, profile evidence, revoked-role concealment,
internal history recovery, and sign-out clearing after reconnection.

At 320/768/1024/1440px there is no horizontal overflow; choice targets are 48px.
Signed-in mobile queue lab: performance 98, accessibility 100, best practices 96,
LCP 2.260s, TBT 14ms, CLS 0.07024. Private-route SEO 63 is intentional. Known
inline CSP hardening remains open. Results use disposable loopback fixtures,
not public activity, production latency or field INP.

Formatting, lint, strict typecheck, 90 Node/11 Python tests, production export,
and the 785,699-byte compiled worker pass. Fifteen-migration actor/isolation and
extraction tests passed with the backend increment. Remote migrations remain
001–013 until exact-main CI and the guarded additive operator complete.

### Staff report rollout verified

PR13 head `8533e9abf7f78cfbb8959cc3613253fe99502b9a` passed CI
`37677114202`. Merge/main `f1ba28b58cad259ced1be838b6f32bbed24a512d`
passed `37677553757`. The guarded operator applied 014 and 015 from that clean
exact main. Protected fingerprints remained unchanged before/after both
transactions. Read-only anonymous/nonmember isolation checks passed afterward;
no application rows were created. Fifteen migrations are remote. Full community,
registration and production launch remain open gates.

### Fork creation — backend acceptance

Atomic fork creation derives the portable definition from an approved available
source, retaining its exact license and immutable ancestry. New private drafts
start at 0.1.0 with empty editorial content; source approval never transfers.
An owned same-source/same-path retry recovers its original resource rather than
creating duplicates. Other owners' path collisions disclose no private content.
The lineage insert guard refuses branches whose complete attribution would exceed
the bounded public projection. Membership, source visibility, CSRF, exact receipt
and protected-app denial are tested. Sixteen-migration disposable isolation and
extraction tests pass. Migration 016 remains local; UI/browser gates are ongoing.

### Fork browser and layout acceptance

The source-to-branch interface performs live membership/source checks, keeps
inherited terms visible, and opens the resulting private definition in the
creator workspace. It reports new creation versus recovered creation honestly.
Reserved/invalid paths have labelled feedback; an uncertain request locks its
identity fields and retries the same database operation. The source permission
is checked again during creation, not trusted from the displayed page.

Synthetic browser checks pass anonymous sign-in return, occupied-path rejection,
interrupted acknowledgement recovery, exact receipt/focus, editing the inherited
private draft, locked source license, source blocking between load/write, and
fresh successful creation. 320/768/1024/1440px checks have no overflow and inputs
are 48px tall. Console errors: none. Public links appear only on released
resources with explicit public-fork permission.

The first mobile audit found footer movement during async loading (CLS 0.15168).
Reserving the workspace's initial viewport fixed the measured issue. Repeat lab:
performance 98, accessibility 100, best practices 96, LCP 2.330s, TBT 20ms, CLS 0.
Private-route SEO 63 is intentional; CSP and real production latency remain
separate launch gates. Full public fork/lineage publication requires the genuine
release inventory; these fixtures are never published.

Formatting, lint/typecheck, 93 Node/11 Python suite tests plus the added passing
return-path test, production export and 787,688-byte compiled worker checks pass.
Sixteen-migration actor/isolation/extraction passed. Private CI and guarded
migration 016 rollout remain pending for this increment.

### Fork CI gate

PR14 head `75854dfc6cf254fda1a4270ff98e5f5feec756f4` passed CI
`37718899418`. Merge/main `504005727476c66d721b9b39c729b58027517873`
passed `37719212069`. Migration 016 awaits guarded rollout with 017.

### Immutable submission inspection and rejection

Migration 017 adds bounded staff projections of immutable submitted versions,
without exposing creator working drafts or shared Auth identity. Rejection is
bound to the exact content digest, requires active AgentGrid staff, refuses
self-review and competing decisions, applies a server quota and records the
existing immutable audit trail. Legacy submission decisions retain owner
withdrawal only; clients cannot bypass the new rejection boundary.

The private queue supports 20+3 pagination, focus restoration, complete plaintext
document inspection, structural issue summaries, creator feedback, explicit
confirmation, uncertain-acknowledgement recovery and retained tab-local notes.
Structural completeness is explicitly separate from editorial, safety, rights
and real host verification. This increment does not claim publication approval;
creator guide authoring and the trusted publication workflow remain open gates.

Seventeen-migration disposable PostgreSQL actor/isolation/extraction tests pass.
Browser checks cover anonymous/member denial, pagination/focus, cancellation,
exact rejection receipt, competing withdrawal, lost acknowledgement recovery,
self-review refusal, plaintext malformed JSON, staff revocation concealment,
internal navigation retention and sign-out cancellation/clearing. The missing
sign-in return route was corrected and verified against the restarted backend.

Responsive checks at 320/768/1024/1440px have no overflow or console errors.
Mobile lab: performance 96, accessibility 100, best practices 96, LCP 2.359s,
TBT 33ms, CLS 0.08948. The audit caught and verified a corrected visible/accessibility
label mismatch; the same report-queue mismatch was fixed. Private noindex SEO 63
is intentional. Known inline CSP hardening remains a later security gate.
All browser data is explicitly synthetic, local-only and never published.

Final formatting, lint, strict typecheck, 98 Node/11 Python tests, production
static export and the compiled worker acceptance suite pass. Remote 016/017
remain unapplied until exact-main CI and the protected-resource operator pass.

### Submission moderation CI gate

PR15 head `294aeacabc77aa04378d2441cde07e38cebdd5ed` passed CI
`37720872816`. Merge/main `7babc93ece247367670830a63eb87a4dddfd3599`
passed `37721104749`. Guarded migrations 016/017 remain pending alongside 018.

### Creator guide authoring and immutable export

Creators now author private overview, audience, workflow, FAQ, checked sources,
related-resource paths, discovery vocabulary and explicit readiness declarations.
The definition and guide save under one optimistic revision. Omitted guide updates
retain previous content; supplied updates use a closed bounded contract. Unfinished
guides never imply staff approval or real host verification. Submission freezes the
exact guide alongside the definition. Migration 018 includes this owned author
content in private version exports; staff evidence and publication manifests remain
separate and inaccessible. No protected shared-app resources are changed.

Authoring adds guide import/download and practical readiness corrections. Browser
acceptance verifies persistence after reload, conflicting-revision retention,
deliberate discard, strict import rejection, source context, frozen guide inspection,
and unchanged submitted content after later draft edits. Guide sections load on
demand. 320/768/1024/1440px checks have no overflow or console errors. Mobile
inspection prompted fixes for active-step visibility and the cramped save status.

The initial signed-in mobile lab measured LCP 2.501s. The trace identified blocking
local QA tooling and unused guide tools; QA injection is now deferred and guide
components are split from initial authoring. Repeat: performance 97, accessibility
100, best practices 96, LCP 2.493s, TBT 40ms, CLS 0.04583. This has little LCP
headroom and is local lab evidence, not field INP or production performance. Public
performance, CSP and real network conditions remain hardening gates. Private
noindex SEO 63 is intentional. Fixtures never become public content.

Eighteen-migration actor/isolation/extraction tests pass, including immutable guide
preservation. Formatting, lint, strict typecheck, 101 Node/11 Python tests,
production export and compiled-worker checks pass before the final code-splitting
change; final build acceptance is recorded after that change below.

Final code-split production build and compiled-worker acceptance pass. Browser
checks confirm all three on-demand guide tools load, preserve edits and save
correctly, with no console errors. Eighteen migrations remain local until guarded
rollout after the private pull request and exact-main CI gates.

### Creator-guide CI gate

PR16 head `b70139797ad99c95f7d6e6a5e494ac5c0fbc23fa` passed CI
`37722276792`. Merge/main `bc715336358d5c1e036d379f1fecb5b9970f22e3`
passed `37722502194`. The initial rollout attempt correctly refused before
main CI completed; no migration was applied. Migrations 016–018 remain pending
with 019 until the next clean exact-main rollout.

### Revision-bound agent access moderation

Migration 019 introduces status revisions for every agent status transition,
including account archival. Staff decisions lock against governance changes,
bind the expected revision and released version, reject self-review and archived
resources, require an active owner for restoration, enforce quotas and append
an immutable audit entry. Legacy direct moderation execution is revoked.
Only existing safe columns and the status revision retain direct read permission;
private investigation notes are available through a staff-checked projection.
This explicit column grant corrects an issue caught during pre-commit security
review: a table-level SELECT grant would otherwise expose newly added notes.

The private access screen connects from report investigations and immutable
submission inspection. It supports explicit confirmation, cancellation/focus
restoration, stale decision recovery, uncertain acknowledgements, retained
notes and staff revocation concealment. Static publishing/takedown remains a
separate open gate; the UI never claims this live decision purges static content.

Nineteen-migration actor/isolation/extraction tests pass after the privacy fix.
Anonymous/nonmember/member/self-moderator/admin/suspended-owner/archived-resource
paths are tested, alongside denied raw note access and unchanged PicMagic fixtures.
Formatting, lint, strict typecheck, 103 Node/11 Python tests, production export
and compiled workerd acceptance pass; the additional sign-in-path test also passes
(104 Node tests total). Browser checks cover session return, member denial,
confirmation/Escape focus, block/restore receipts, conflict/lost-ack recovery,
self-review denial, navigation retention, revoked access and sign-out confirmation.
320/768/1024/1440px layouts have no overflow or console errors. Mobile lab:
performance 98, accessibility 100, best practices 96, LCP 2.266s, TBT 9.5ms,
CLS 0.05650. Private noindex SEO 63 is intentional; CSP/production latency remain
hardening gates. All fixture data stays local and is never published.

### Protected rollout and resource-moderation CI

Migrations 016–018 were applied from clean main
`bc715336358d5c1e036d379f1fecb5b9970f22e3` after exact-main CI. Protected
PicMagic inventory remained unchanged before/after each migration. Post-rollout
anonymous/authenticated-nonmember boundaries pass; no real application rows were
created. PR17 head `a6d808fab6eda88e2260e946fac95d7cbe8432d9` passed CI
`37723405537`; merge/main `559c19897cb35c7ab076ca3f823fb89f67601383`
passed `37723682713`. Migration 019 remains pending with the evidence increment.

### Private host-verification evidence

Migration 020 retains immutable AgentGrid-only observations against exact submitted
versions, with server-recorded staff provenance, digest binding, strict direct-RPC
shape/size checks, quotas, a 60-record version limit and idempotent request IDs.
Anonymous/nonmember/creator/raw-table access is denied. Recording does not approve
a submission, and failed assertions remain visible. Only private staff projections
return observations. Lists return compact summaries; full redacted input/output
is requested only for a selected record. Existing shared app/Auth resources are
untouched. Extraction includes an owned evidence fixture and preserves its data.

The HTTP boundary reloads the immutable specification, computes its canonical
checksum and refuses mismatched host/platform/content, stale/future dates, likely
credentials, authority fields and oversized requests. Publication still requires
an independent trusted review and full quality gate. These are observation records,
not automatic proof that a staff member truthfully performed a real test.

The on-demand editor covers host/model/date, input/output, explicit assertions
(default unpassed), notes, redaction acknowledgement and confirmation. Browser
acceptance verifies exact private receipts, failed-check retention, unchanged
pending submission, lazy detail inspection, Escape cancellation, interrupted
acknowledgement readback without duplicate writes, held edits across hide/show,
and concealment after staff revocation. Native date entry was verified through
keyboard commit. All evidence used for acceptance is synthetic, memory-only and
explicitly labelled; none is recorded in Supabase or used as launch verification.

108 Node/11 Python tests, formatting, lint, strict typecheck, production export,
compiled workerd and the 20-migration isolation/extraction suite pass. Responsive
320/768/1024/1440px checks have no overflow, 48px text inputs and no console errors.
The isolated local editor lab measures performance 98, accessibility 100, best
practices 96, LCP 2.326s, TBT 13ms and CLS 0. Private/local noindex SEO 63 is
intentional. This is presentation lab evidence, not authenticated production
latency or field INP. The QA route is removed and verified absent from production.
Trusted release approval, publication batches/takedown/recovery and real launch
inventory remain open work; this increment does not complete publication.

### Evidence rollout and reviewed publication

PR18 head `f11f89bff3c6256aef3e09ef5ac3ca16e6774bd6` passed CI
`37725295750`; merge/main `fdd96ebd79ed457aa42f9fc9575ea6d017c10912`
passed `37725529240`. Guarded migrations 019–020 were applied from that clean
main commit. Protected PicMagic inventory remained unchanged; live anonymous and
authenticated nonmember boundaries passed without creating application rows.

Migrations 021–022 add immutable publication review requests and separate immutable
outcomes. Each request records the authenticated reviewer, explicit review checks,
selected version-bound observations, content digest, agent moderation revision and
previous release. Seven-day expiry, quotas, cancellation, active-owner/staff checks
and transaction locks prevent stale reviews from publishing. Ordinary moderators
cannot approve their own submissions. Administrators can review their own content,
but the self-review is explicitly labelled and retained; this does not invent an
independent reviewer. No actual staff account or release was created by this work.

The legacy direct service-role publisher is revoked. The trusted job reads the
persisted request and selected immutable observations, reruns the full editorial,
rights, security and real-host quality gate, then submits a compact manifest to the
transactional release RPC. The RPC rechecks mutable eligibility and records its
exact outcome atomically. Matching retries return historical receipts without
republishing an old version. A separate read-only endpoint supports lost-response
recovery. No privileged credential is added to browser, Pages or GitHub configuration.

The staff interface loads on demand. It supports evidence selection, initially
unchecked review confirmations, bounded rationale, explicit confirmation, cancellation,
private history and held notes. A competing agent revision cannot silently rebind
old confirmations: a deliberate reset preserves notes/selections and clears all six
checks. Browser acceptance covers Escape/focus restoration, retained notes across
hide/show, exact receipts, cancellation, lost-response readback without duplication,
and concealment after staff revocation. Synthetic fixtures remain memory-only and
are never real verification or public content.

113 Node tests, 11 Python tests, formatting, lint, strict typecheck, production
export, compiled workerd and the 22-migration isolation/extraction suite pass.
Responsive 320/768/1024/1440px checks show no horizontal overflow; selectable rows
are at least 50px tall on desktop and 73px at 320px. Browser console errors: none.
Isolated mobile presentation lab: performance 99, accessibility 100, best practices
96, LCP 1.962s, TBT 10.5ms, CLS 0. Private noindex SEO 63 is intentional. These
measurements do not establish authenticated production latency or field INP.
The local acceptance route is removed and verified absent from production.

Static publication batches, deployment confirmation, urgent takedown/recovery,
real host-tested inventory and the remaining launch gates are still open.
Migrations 021–022 are local until private PR and exact-main CI acceptance.

### Reviewed release rollout and local fixture build isolation

PR19 head `8eb542dc7cb858cc6a08ab9c8f0faeb29a9da2cc` passed CI
`37727384829`; merge/main `df4127fc86f2a6895be4fbeac5b9f9c4ad865dad`
passed `37727594693`. Guarded migrations 021–022 were applied from that clean
main commit with unchanged protected PicMagic fingerprints. Live anonymous and
authenticated nonmember boundaries pass; no staff role, observation or release
was fabricated or created remotely.

A follow-up export audit found unused local acceptance components in generated
production JavaScript despite their route removal. Test pages now use a custom
`.qa.tsx` extension recognized only by the explicitly local preview configuration.
Production excludes the entries and their client chunks at compilation. A client
fixture marker makes the export gate reject accidental future bundle inclusion.
Production format/lint/typecheck/tests/export checks pass, the previously observed
fixture strings are absent, and the local optimized build/browser fixture remains
functional. This improves the delivery boundary before public deployment.

### Consistent public capture and live detail withholding

Migration 023 introduces an AgentGrid-owned snapshot revision, bounded anonymous
public index and opaque detail-delivery tags. Capture rejects changes between its
initial and final index, projects only public fields, and emits a local candidate
with exact catalogue digest/version inventory. Frontend and Worker builds reject
inconsistent inputs. The committed empty pair is bootstrap state, not a claimed
remote capture. Production inventory remains zero.

The compiled Pages boundary now covers agent detail HTML and Next navigation
payloads: withdrawals return 410, changed/unverifiable versions return 503, and
unknown paths return 404. All detail bodies are no-store; unverified content never
falls through to static assets. Listings remain static and require urgent rebuild
to remove withdrawn summaries. Fail-closed quota behavior and cache-rule checks
are mandatory production gates, not yet verified provider settings.

Local acceptance: 123 Node and 11 Python tests, formatting, lint, strict typecheck,
production export and compiled workerd pass. The 23-migration actor/isolation suite
and independent owned-data extraction/reassociation pass with protected fixtures
unchanged. During extraction rehearsal only owned target user triggers are paused;
FK checks complete before they are restored and the import commits. Browser checks
of the branded 404/410/503 presentation cover 320/768/1024/1440px with no horizontal
overflow and visible keyboard focus; controls are at least 48px high. No client JS
or motion is required for these states. Evidence is local and ignored.

Migration 023 is local pending exact-head/main CI and guarded rollout. Promotion,
deployment batch receipts, production delivery checks and actual editorial/host
inventory remain open. See PUBLICATION_DELIVERY.md for operational boundaries.

PR20 head `74f0052857956e018fd33b2bf5db5033f08f0b85` passed CI
`37729560182`; merged main `733d82b5fd03d64e58330dc9c76bc2029f59d296`
passed `37729767506`. Guarded migration 023 is applied with protected PicMagic
fingerprints unchanged. Post-rollout live anonymous/nonmember checks pass. A real
public-key-only capture succeeded at revision 0 with zero released resources;
it is retained as an ignored local candidate and is not launch inventory.

### Reviewed capture promotion and isolated staging

The next increment adds reviewed candidate promotion with a fresh public-source
comparison and a manual exact-main staging deployer with private receipt retention.
An additive setup tool created and read back the empty `agentgrid-staging` Pages
project. Both provider deployment configurations explicitly have `fail_open=false`,
compatibility date 2026-10-07, no service bindings and only application stage/origin
plaintext settings. No secret, deployment, custom domain, billing or paid feature
was added. The infrastructure proof and other applications remain unchanged.

Staging server credential authorization is pending: a separately revocable named
Supabase secret would still have project-wide privileges; it must not be mistaken
for an AgentGrid-only database credential. Existing Resend sending authority is
AgentGrid-domain restricted. No staging credential has been created/transmitted.
Real auth/deployment acceptance cannot be claimed until this configuration and
provider verification complete.

Promotion/staging local acceptance passes: 128 Node and 11 Python tests, lint,
formatting, strict typecheck and production build. The assembled static/compiled
Worker output passes the export scan. Tests deny stale candidates, symlink inputs,
wrong repository/branch/commit, unsafe existing staging configuration, repeated
uncertain creation and invalid live deployment receipts. No real staging deploy
is claimed; provider credential bindings and authenticated QA remain pending.

### Profile-bound account deactivation

Account controls now expose deliberate AgentGrid-only deactivation with exact
username confirmation, an unchecked acknowledgement and an accessible confirmation
dialog. The request binds to the immutable business profile ID; migration 024
revokes the old username-only entry point so a delayed request cannot remove a
later membership. Last-administrator protection and retained immutable versions
remain in force. Shared authentication and PicMagic application data are untouched.

An unconfirmed response freezes removal and offers a fresh identity/account check.
An active original membership resets consent before retry; suspended/replaced
profiles are denied. Confirmed removal clears held creator buffers and provides
scoped session sign-out. The UI explicitly describes retained submitted versions,
including unpublished ones, and does not promise complete historical erasure.

Local acceptance: 130 Node tests and 11 Python tests, formatting, lint, strict
typecheck, production export and freshly compiled workerd checks pass. The
24-migration disposable actor/isolation/extraction suite passes, including stale
profile binding, revoked legacy permission and shared-auth retention. Browser QA
uses memory-only synthetic identities: confirmation cancellation/focus restoration,
successful removal, lost acknowledgement recovery, scoped sign-out/history, exact
account deep-link return and suspended-account denial. Responsive checks at 320,
768, 1024 and 1440 CSS pixels found no horizontal overflow; confirmation input is
48px high. Screenshots are retained under ignored local evidence. No real account
was removed and migration 024 is not yet applied to the shared remote project.

PR22 head `4c9ee9af62b2ffa21d7e76157541f59c0c2caee4` passed CI
`37732091409`; merged main `4dd2c38f0477ebf497086d3587ab6396a07f90d4`
passed `37732249852`. The shared-project rollout stopped at metadata prerequisites
(one timeout and one protected-audit subprocess failure). Read-only reconciliation
confirmed 23 installed migrations and 024 still pending. No transaction intent was
created; no account or protected application data was changed. Do not bypass the
guard or claim 024 remotely installed.

### Static CSP hardening

Generated per-document script/style hashes replace broad inline-script permission.
The build parser and export gate reject missing, misplaced and mismatched policies;
Function-delivered agent/listing responses now attach framing and related headers
explicitly. The pinned HTML parser is build tooling only. Browser acceptance and
the deliberate injection fixture pass; mobile lab results are 99 performance,
100 accessibility, 100 best practices, LCP 2.0s, TBT 30ms and zero CLS. Noindex SEO
63 remains intentional. See `STATIC_SECURITY.md` for limitations and evidence.

### Revision-bound profile administration

Administrators can inspect an exact AgentGrid username and make one reasoned
suspension, restoration or staff-role decision. Migration 025 introduces a profile
governance revision advanced by profile and role changes. Every mutation requires
that revision and the immutable profile ID, checks fresh administrator authority,
and preserves the last active administrator. Legacy unbound mutators and internal
snapshot helpers are not client-callable. The closed response excludes shared
identity identifiers and email addresses; no PicMagic resource is changed.

The browser holds unsubmitted reasons only in tab memory. An unconfirmed response
locks further decisions until a live reload and explicit review; review clears the
old action and typed confirmation while preserving the reason. No automatic retry
occurs. Native confirmation dialogs restore focus on Escape. Revoked administrator
authority is enforced by the server even from an already-open form.

Acceptance: the 25-migration disposable actor/isolation/extraction suite and freshly
compiled workerd boundary tests pass. Browser testing exposed and fixed a missing
administrator endpoint in the client request allowlist; a regression test covers
exact allowed paths and rejects extra query arguments and foreign destinations.
Synthetic browser checks pass for member/moderator denial, administrator lookup,
role grant, suspension/restoration, stale revision, lost acknowledgement after a
committed mutation, and revoked authority. No browser console errors were observed.
320/768/1024/1440px layouts have no horizontal overflow; local screenshots are
retained under `docs/evidence/phase6-admin-*`. No real role/account changes occurred.
Migrations 024 and 025 remain pending remote provider availability and guarded rollout.

### Broad-consumer inventory expansion

The editorial draft foundation now contains 36 distinct packages: four each in
marketing, productivity, research, education, content, ecommerce, business
operations and everyday workflows, plus two each in SEO and development. These
are private first-party drafts, not 36 launch-ready or host-tested agents. The
public catalogue remains empty. Every new package includes concrete instructions,
privacy/limitations, normal expected behavior with task-specific assertions,
missing-context and adversarial-input examples, and explicitly unselected rights.

The new work includes response-versus-person survey counts, bounded weekly
capacity arithmetic, timestamp/overlap checks, study design interpretation,
source-grounded flashcards, contextual alt text, variant/SKU conflicts, missing
return-rate denominators, dependency cycles and reviewable household planning.
Curated aliases add 11 consumer search evaluation cases. A category test that
assumed only one everyday resource was replaced by actual category membership
checks. The public build remains isolated from every draft.

First-party reuse terms are a concrete pending business decision in
`FIRST_PARTY_REUSE_DECISION.md`. No package license was changed. Real host runs,
editorial source review, immutable submission/release and publication evidence
remain mandatory before any draft counts toward launch inventory.

PR24 administrator head `4a793b07a2be131ca0780a612b970adcbf3e7b21`
passed CI `37734761991` and merged to main
`c77b759e4d1137a9af1f355fedb502c71a6d445f`. Guarded rollout installed
024 and 025 and verified protected shared resources unchanged. Subsequent live
anonymous/authenticated read-only boundaries passed; no application rows were
created. PR25 creator head `dfab7f38456b03ac0c11ec635ecd14d34abd107b`
passed CI `37735994904` and was merged. Migration 026 remains pending its guarded
rollout. Creator mobile lab scores are 100 performance/accessibility/best
practices, LCP 0.9s, TBT 0ms, CLS 0; noindex SEO remains intentionally limited.

The 36-draft browser acceptance exposed crowded desktop node labels. The map now
uses at most nine separated desktop positions (four on mobile), two bounded name
lines with full accessible labels, and desktop paging controls. Search removes
nonmatching nodes; reviewed draft capability links cover the added workflows.
The list remains complete and authoritative. Browser acceptance verifies six
remaining resources on page two, new-resource selection, task queries for alt text
and calendar overlap, complete calendar detail, and no horizontal overflow at
320/768/1024/1440px. Desktop/mobile screenshots are retained under
`docs/evidence/phase6-inventory-*`. Full local checks pass: 138 Node and 11 Python
tests, formatting, lint, strict typecheck and production export. Draft preview
contains 58 documents; the public export still contains zero agent resources.

### Live public creators and private profile reporting

`/creators/[username]/` is a live Cloudflare-rendered HTML document using only the
anonymous Supabase projection. This deliberately small, script-free surface avoids
stale biography/privacy data in the static catalogue. Migration 026 returns only
active, opted-in contributing profiles and current public releases, with bounded
20-item pages. No shared identity, private drafts, roles or quality evidence enter
the response. Static resource bylines link to the public creator route.

The document has canonical/social metadata, semantic contribution links, explicit
first-party/community attribution, plain escaped user text and a strict header CSP.
Legacy unsafe website URLs are not rendered as links. Missing/private profiles
return 404; lookup failures return no-store 503 instead of stale content. Creator
profiles remain noindex pending a separate editorial indexing policy; their public
existence alone is not proof of standalone search value. They are not placed in the
sitemap. Profile requests consume the free Workers request allowance and a bounded
public database read; real provider latency and quota validation remain staging gates.

A dedicated private reporting entry resolves the current public creator and uses
the existing authenticated, consent-bound report flow. Synthetic browser acceptance
verified sign-in return, a recorded private report, immediate 404 after privacy
change, outage/recovery, keyboard skip focus and script-free HTML. Creator and report
layouts have no horizontal overflow at 320/768/1024/1440px. Browser inspection led
to a grouped report heading and wrapping for long usernames. Lighthouse exposed a
wordmark accessible-name mismatch, corrected before acceptance. Local evidence is
retained under `docs/evidence/phase6-creator-*`.

142 Node tests, 11 Python tests, formatting, lint, strict typecheck, production
export and fresh compiled workerd tests pass. The 26-migration disposable database
suite passes public/private/suspended/non-contributing projection checks, live
profile edits, pagination bounds and protected application extraction/isolation.
No synthetic creator or release has been inserted into a real provider database.

### Consumer learning guides

Three original editorial guides now support choosing a resource, checking an
interactive first run, and distinguishing source material from permission. Each
has a practical selectable worksheet, a structured summary, a dated editorial
byline, anchored sections and related reading. Security claims cite checked OWASP
and NCSC primary guidance. No named reviewer, observed host run or popularity is
invented. The guide content is a bounded, schema-checked repository document;
unknown fields, broken citations/routes, unsafe source URLs and future review
dates fail the build. Rendering uses escaped text and escaped Article/Breadcrumb
JSON-LD, with canonical URLs on agentgrid.me. These prelaunch routes stay noindex
and outside the sitemap until the production indexing gate is approved.

Browser inspection found and corrected missing shared page gutters. The Learn
navigation now remains available on mobile. Acceptance verifies guide navigation,
working-template text selection, keyboard skip focus, canonical/schema output,
source links and no horizontal overflow at 320/768/1024/1440px. The optimized
mobile article lab scores 99 performance, 100 accessibility and 100 best practices,
LCP 2.0s, TBT 10ms and CLS 0. SEO 66 reflects intentional prelaunch indexing blocks;
this does not establish field INP or production crawlability. Evidence is retained
under `docs/evidence/phase6-learning-*` and `phase6-learn-hub-*`.

PR26 integrated head `1af0893d3e0dd87fffcf3fa00f50fa4e993dccaf` passed
CI `37738638365` and merged to main
`bde3bbfe5f6d71eeee1821b9d0ab18998a69bd20`. Guarded rollout from that exact
main installed migration 026 and verified protected shared resources unchanged.
No real creator/profile rows were created. Staging credential authorization,
first-party package licensing and legal operator details remain pending owner input.

### Branded missing-page and rendering recovery

The application now has a custom root not-found page, a segment error boundary,
and a root-layout fallback. Recovery links use fresh document navigation so they
do not depend on a failing client router. Exception messages, stack traces and
request data are never rendered by the fallback. A user-triggered retry uses this
installed Next version's `retry` API; mutations are not replayed by the fallback.
The rendering error focuses its heading and restores the prior document title
when recovery succeeds. Global fallback imports its own required styles.

A local-only fixture triggers an actual rendering failure and is excluded from
public compilation. Browser acceptance verifies throw/retry twice, focus, title
restoration, navigation back to Learn and a real unknown-route HTTP 404. Inspection
caught duplicate not-found title elements; the supported Next metadata export
replaces inline title markup. The corrected 404 has one title and noindex metadata.
Responsive checks at 320/768/1024/1440px show no horizontal overflow. The exported
404 document scores 99 performance, 100 accessibility and 100 best practices in
mobile Lighthouse (LCP 2.1s, TBT 30ms, CLS 0). This lab serves the exported document
at /404.html for auditing; a separate request verifies unknown routes return 404.
Full formatting/lint/typecheck, 145 Node and 11 Python tests and the production
export pass. Root-layout error rendering has compile coverage; provider-induced
500 failures and cross-browser recovery still require staging acceptance.

PR27 learning head `3454e4088fd7087fcdb4997d7b4cad0e7affa5ad` passed
CI `37740433580` and was merged. No production deployment was performed.

### Guided recipes and mixed discovery

Six first-party draft workflows now connect everyday, education, research,
ecommerce, marketing and business tasks to exact instruction versions. The
server-rendered layout follows a visible sequence with explicit inputs, review
checks, human handoffs, stop conditions and honest limits. Recipes participate in
outcome search with qualified identities; agent-only browsing remains separate.
The public manifest is empty until actual workflow evidence and editorial review
pass. See `RECIPE_PUBLICATION.md` for the trusted publication boundary and batch
withdrawal behavior. No new provider resources or costs were introduced.

Acceptance verified pinned resource navigation, related learning guidance, step
anchors, keyboard skip focus, canonical/noindex output and no horizontal overflow
at 320/768/1024/1440px. Mixed search ranks the meeting follow-up recipe first and
identifies its pending workflow review. Mobile Lighthouse scores 99 performance,
100 accessibility and 100 best practices (LCP 2.2s, TBT 30ms, CLS 0). Intentional
noindex limits SEO to 66; this is not production or field-performance evidence.
148 Node and 11 Python tests, formatting, lint, strict typecheck and production
build pass. An additional negative check rejects stale recipe HTML and RSC files.
The public export has 24 documents and zero agent/recipe releases; local preview
has 71 documents including 36 agent drafts and six recipe drafts.

PR28 recovery head `e001d5bde3af2fc907e9e2eb0b9b6636247fa0cc` passed
CI `37741877858` and merged. No application deployment was performed.

### Broad category guidance and type-aware discovery

Ten server-rendered category guides now provide task-selection paths, inputs,
review criteria and stop conditions. A separate `/categories/` route family avoids
agent/category slug collisions. Category search uses a qualified identity and an
explicit editorial state; it does not imply agent host testing or package rights.
The homepage now uses the real discovery shell in public builds, with approved
editorial guidance even while agent publication remains empty. Prelaunch noindex
and sitemap exclusions remain enforced. Historical infrastructure-proof deployment
continues to refuse application builds rather than silently expanding its scope.

The resource-type control supports agents, recipes and category guides through
the existing search abstraction. Browser testing verifies filtered results,
unmatched-query recovery/reset, related-category navigation, connected-resource
anchors, canonical/noindex output and 320/768/1024/1440 layout bounds. The mobile
review exposed hidden format/status labels; these now remain visible for every
result. Empty-selection and mixed-catalogue language no longer imply host review.
Category mobile Lighthouse: 99 performance, 100 accessibility/best practices,
LCP 2.2s, TBT 30ms, CLS 0; SEO 66 is intentional prelaunch noindex. This is local
lab evidence, not production field data. Full checks pass 150 Node/11 Python tests,
formatting, lint, typecheck and production export. Public export has 35 documents;
local preview has 82. No public agent or recipe release was created.

PR29 recipe head `f487fbe` passed CI `37743505905` and merged. No deployment or
provider resource change was performed in this milestone.

### Community entry and sign-out polish

A public workspace link now makes community entry discoverable without adding
identity requests to public content. The mobile header keeps it alongside the
wordmark and puts discovery links on a second row. Sign-in and workspace main
landmarks support keyboard skip focus. After confirmed logout, synchronous state
cleanup removes held edits and beforeunload listeners before document replacement.
A browser test found the initial listener/navigation race; the corrected unsaved
edit → discard → sign-in journey passes, and direct workspace access is signed out.
Synthetic data is disposable and never sent to a provider. Full checks remain
150 Node/11 Python tests with lint, format, typecheck and production export passing.

PR30 category head `64f6e42` passed CI `37744699340` and merged. Remaining
owner inputs (staging credential authorization, legal identity and first-party
reuse decision) are unchanged. No paid service, public release or application
deployment was activated.

### Platform and connection guidance

Six source-checked editorial guides cover three platforms, two integrations and
MCP concepts. Their bounded schema validates dates, references and official source
hosts. Integration guidance participates in task discovery without claiming a
connector is installed. Exact declarations link resources and platform guidance;
protocol guidance cannot masquerade as a server listing. Related-resource lists
are bounded to eight with an honest total. Provider facts and editorial advice
remain distinct; no host evidence, license or publication claim was fabricated.
See `CONNECTION_GUIDANCE.md` for review cadence and static freshness limitations.

Browser acceptance verifies 320/768/1024/1440 layout bounds, keyboard main focus,
checklist anchors, agent/platform round-trip links, integration-filtered search
and MCP related navigation. Canonicals use agentgrid.me; noindex and sitemap
exclusions remain. Full checks pass 153 Node/11 Python tests, formatting, lint,
typecheck and production export (44 documents); local preview has 91 documents.

PR31 community-entry head `11e3b00` passed CI `37745518940` and merged. No provider
resource, database migration or paid feature was changed in this milestone.

Guide mobile Lighthouse without the disposable QA toolbar: performance 99,
accessibility 100, best practices 100, LCP 2.2s, TBT 30ms, CLS 0. SEO 66 reflects
intentional prelaunch noindex. This is local lab evidence, not field INP or
production delivery evidence.

### Branded social previews

A locally generated 1200 × 630 PNG now supplies Open Graph and Twitter large-image
cards across static routes and live creator responses. It contains only brand
copy and decorative network artwork. Titles/descriptions remain page-specific;
no private data, invented activity or remote avatar enters the graphic. Generation
uses the existing Next/React installation with no new dependency or runtime call.
The rendered asset was visually inspected and its short description reflowed to
avoid a stranded final word.

The build verifies the actual PNG signature/dimensions/size and both exact-domain
image references in every exported HTML document. Static production and local
preview verification remain separate from external sharing-provider acceptance.
See `SOCIAL_PREVIEWS.md` for regeneration and production checks.

Social acceptance passes 154 Node/11 Python tests, lint/format/typecheck, 44-document
production export, backend compilation/workerd boundary tests and 91-document
private preview. Browser inspection confirms both canonical-domain image tags,
large-card type and successful 1200 × 630 image delivery. External social caches,
production headers and public crawl visibility remain deployment gates.

### Private aggregate measurement foundation

Optional first-party measurements now cover public landing views, settled result
bands and published-resource actions. Browser projection and strict server/database
validation exclude raw queries, URLs, cookies and visitor identifiers. DNT/GPC and
private previews suppress collection. A serialized 2,000-event daily ceiling bounds
accepted writes; it does not cap provider requests. No public popularity counters
or install claims are derived from these observations. Both activation flags remain
off. Retention/notice/provider acceptance requirements are in `ANALYTICS.md`.

Acceptance passes 158 Node/11 Python tests, formatting, lint, typecheck, production
export and backend/workerd tests. The 27-migration rehearsal preserves protected
PicMagic fixtures and owned-data extraction/reassociation checksums and lineage.
The rebuilt browser search returns the meeting follow-up recipe first, with honest
draft labels, no horizontal overflow and no console errors. The browser inspection
API does not expose resource timing, so live network absence is not claimed;
disabled transport is verified by executable client and compiled Worker tests.
Enabled production traffic and retention operations remain rollout gates.

PR32 connection-guidance head `da535c4` passed CI `37747187575`; PR33 social-preview
head `4ab5d67` passed CI `37747794550`. Both merged. No paid service or analytics
activation was introduced. Migration 027 is locally validated and awaits the
clean-main protected-schema rollout.

### Generated crawlability acceptance

The production build now audits its rendered HTML: clean agentgrid.me canonical
URLs, distinct public titles/descriptions, one meaningful H1/main landmark, unique
element IDs, structured-data JSON, internal paths/fragments and publication-only
sitemap consistency. Negative fixtures reject private/query sitemap entries,
malformed XML/JSON, duplicate metadata, missing destinations and symlink inputs.
Four directory descriptions now state their own search intent instead of inheriting
the generic site description; the MCP title uses the correct acronym.

Acceptance passes 161 Node/11 Python tests, formatting, lint, strict typecheck and
production build. All 44 generated documents and 763 internal links pass the crawl
audit. Zero released sitemap URLs correctly reflect the empty public inventory.
Noindex, robots exclusion and the parked production domain remain unchanged; this
is output verification, not public launch or provider acceptance.

PR34 analytics head `dfe4296` passed CI `37887252278` and merged as `0999605`. The
remote operator inspected the protected schema, then refused application while
the new main CI was still pending. No partial migration occurred: remote history
remains at 26 migrations until a later successful exact-main application.

### Reviewed release operator and owner decisions

Migration 027 subsequently applied once exact main `0999605` passed CI. Live
anonymous/authenticated privilege-denial checks passed and the protected PicMagic
schema/shared authentication baseline remained unchanged. Analytics stays off.
PR35 crawl-audit head `999df78` passed CI `37887779655` and merged as `98b3f95`.

The explicit local release operator now supports read-only preparation, exact
review fingerprints, guarded publication and separate uncertain-result readback.
It refuses currently unservable workflow artifacts. Full local acceptance passes
165 Node/11 Python tests, format, lint, typecheck and production export. See
`RELEASE_OPERATOR.md`; no publication or publisher credential was activated.

The owner supplied Ujjwal Paul, India and contact@agentgrid.me as the individual
operator details; AgentGrid is a brand, not an incorporated entity. First-party
packages must use custom terms permitting personal/commercial internal workflows
and scoped in-platform forks, without blanket redistribution. CC BY was rejected.
Implementation of those decisions follows this milestone; contact delivery still
needs verification. The owner also approved the named revocable staging backend
credential and encrypted Cloudflare bindings, exclusively server-side. These
decisions replace the earlier pending-input notes, not the publication gates.

### Approved staging credential custody

The named staging backend key and approved credentials are now encrypted in the
personal Cloudflare staging main environment. Branch previews contain no secrets.
Bootstrap tests cover dry-run behavior, collision refusal, partial recovery and
lost acknowledgements without duplicate keys or replacing existing credentials.
The ignored local Supabase/Resend copies were removed after provider confirmation.
`STAGING_CREDENTIALS.md` records purpose, scope, recovery and extraction details.

The exact staging OAuth callback was added with chained digest validation. All
other shared auth settings and protected PicMagic resources are unchanged; live
anonymous/authenticated access-denial checks pass. Actual code exchange and email
delivery still need deployment acceptance. No MX record currently exists for
agentgrid.me, so contact@agentgrid.me receiving setup is an explicit launch gate.

### Individual operator and scoped package permissions

Terms, privacy, public contact and a versioned first-party license page now name
Ujjwal Paul as the individual operator in India. Public operator details are
centralized. The custom license permits personal/commercial internal workflows and
attributed forks inside AgentGrid, without general redistribution or resale.
All 36 first-party draft definitions carry that grant; six recipe dependency pins
were refreshed. No public release, platform-test claim or community license was
created. New community drafts remain unselected.

The optional `public_fork_scope` field preserves the existing contract when absent.
Zod and additive migration 028 enforce the scoped exception; package export stays
disabled and inherited license/lineage cannot be broadened. The 28-migration
disposable database rehearsal passed with protected fixtures and extraction intact.
Migration 028 awaits clean-main CI before the remote application.

Browser checks passed at 320/768/1024/1440 widths: no overflow, readable legal
navigation, working section links, canonical metadata, correct contact links,
keyboard main focus and no console errors. Mobile privacy-page Lighthouse scored
99 performance, 100 accessibility, 100 best practices, LCP 2.0s, TBT 20ms and CLS 0.
SEO 66 reflects intentional noindex; this is lab evidence, not field INP. Production
export audits 48 documents and 984 internal links. Public onboarding remains closed
pending working contact mail, retention operations and real community acceptance.

The staging upload is live but Google initiation remains under diagnosis after
correcting the new key's missing service-role claim. See `STAGING_CREDENTIALS.md`.
No paid service, production DNS change or public launch occurred.

### Staging rollout and transport correction

Exact main `0e7e54c` passed validation `37891131472` and staging deployment
`37891206397`. Migration 028 is applied; protected schema/auth fingerprints and
live anonymous/authenticated denial probes pass. The legal pages and versioned
first-party terms are delivered on staging. Public onboarding remains closed.

Sanitized runtime diagnostics and a new compiled outbound test reproduced an
edge-runtime incompatibility: native fetch rejects the `error` redirect mode.
All server provider adapters now explicitly reject redirects using manual mode;
credentials are never forwarded. No provider permissions were weakened. The
compiled test exercises real transport to a synthetic provider, including Google
PKCE initialization and redirect denial, without real credentials or network calls.
Actual staging code exchange remains a separate acceptance gate.

Guided license editing now removes dependent fork grants when use/modification or
redistribution is revoked, clears obsolete scope fields and never silently grants
general redistribution. Inherited source terms remain disabled. Unit acceptance
covers these revocation and scope transitions; browser validation follows.

This increment passes 174 Node tests, 12 Python tests, formatting, lint, strict
TypeScript, production export and compiled workerd acceptance. Browser checks of
the disposable creator editor verify scope selection, permission revocation,
private-save acknowledgement and reload persistence. Widths 320/768/1024/1440 show
no horizontal overflow; the mobile scope label was shortened and reinspected.
No browser console errors were observed. These synthetic checks create no shared
project profiles, reviews, activity or real package releases.
