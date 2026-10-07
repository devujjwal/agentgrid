# AgentGrid implementation ledger

The approved specification is authoritative. This ledger records evidence rather
than treating existing code as completed functionality.

## Phase gates

| Phase                            | Status                               | Exit evidence                                                                                                                                    |
| -------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0 — Ownership and infrastructure | In progress; deployment gates remain | Private personal repository/CI, free Cloudflare delivery, protected Supabase baseline, real email OTP delivery and Google PKCE sign-in verified. |
| 1 — Contracts and content        | Not started                          | Schema/RLS tests; specification; representative reproducible packages                                                                            |
| 2 — Visual system                | Not started                          | Desktop/mobile browser inspection and iteration; accessibility and performance evidence                                                          |
| 3 — Public discovery             | Not started                          | Search evaluation; distribution E2E; crawlable public HTML                                                                                       |
| 4 — Identity/workspace           | Not started                          | Google and real email OTP; cross-account isolation; live saves/drafts                                                                            |
| 5 — Community                    | Not started                          | Full moderation/version/fork/review/report journeys                                                                                              |
| 6 — Publishing/inventory         | Not started                          | Failure recovery; broad tested inventory; no private-data leakage                                                                                |
| 7 — Hardening                    | Not started                          | Restore/rollback; browser/a11y/performance/security audits                                                                                       |
| 8 — Production launch            | Not started                          | Domain, webmaster setup, production journeys and monitoring                                                                                      |

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

## Phase 0 release control — validation in progress

- Exact OAuth milestone `346be06747354cd370726cf04b1b78607c587a7c` passed GitHub CI:
  https://github.com/devujjwal/agentgrid/actions/runs/37582038758.
- Owner approved the separately reviewed expiring account-owned Cloudflare token.
  Pages Write is its only permission; no DNS/billing access or paid activation.
  Provider verifies it as active, and the existing infrastructure project has
  main as production branch and only its pages.dev domain. Credentials are stored
  privately and in encrypted secrets in the verified private personal repository.
- A guarded manual release workflow and pinned deployment CLI are implemented.
  Local formatting, lint, strict typecheck, 18 tests, build and secret-loaded export
  inspection pass. Actual remote release/HTTP/browser evidence is still pending.
- Unpublished previews remain local; no private draft resource is uploaded.
  Authenticated live workspace preview access must be tested in Phase 4 before
  enabling remote private previews. Product publishing remains a separate gate.
- Expanded deployment-tool audit found a patched `sharp` vulnerability. Applied
  the narrow Miniflare override before deploying; full-tree CI now permits only
  the documented exact unpatched lint exception and rejects unassessed findings.
  Updated formatting/lint/typecheck, 20 tests, build and secret-loaded export pass.
