# Identity and workspace acceptance

Phase 4 is in progress. These results establish the HTTP/data boundary and entry
screens; they do not establish complete live community or launch readiness.

## Implemented boundary

- Same-origin Pages Functions handle `/api/*` and `/auth/callback`. Static content
  remains independent. A pinned Wrangler build verifies this route allowlist and
  a 1.5 MB uncompressed server bundle budget; compilation is not deployment or
  proof of Cloudflare CPU/latency limits.
- Email uses managed `generateLink` plus the isolated Resend transport. The
  application challenge lasts five minutes, is browser-bound and single-use, and
  permits five guesses. Shared SMTP, templates and provider OTP settings stay
  untouched. Google uses PKCE and a ten-minute browser-bound, single-use flow.
- Mutations require an exact origin and CSRF token tied to an encrypted HttpOnly
  cookie. HTTPS cookies use the `__Host-` prefix, Secure, Path=/, SameSite=Lax and
  no Domain. Callback redirects are allowlisted and suppress referrers.
- Provider access/refresh tokens are encrypted with AES-GCM and held in owned
  database state. The browser receives an opaque application session identifier.
  Sessions expire absolutely after 30 days; refresh uses optimistic revision
  checks, converges on a concurrent winner and cannot recreate a revoked row.
- Every private operation verifies managed identity remotely. Workspace requests
  use the publishable key and verified user's bearer token, preserving RLS and
  current AgentGrid membership. Shared user metadata cannot assign roles.
- Private JSON is no-store, noindex and has no CORS permission. Provider, database
  and configuration failures never serialize raw messages or input values.
- Nonproduction identity requires an owner pilot allowlist and an exact stage
  origin. Production refuses an accidentally retained pilot restriction.

## Free-tier bounds and isolation

Migration 007 adds only `agentgrid_auth_limits`, `agentgrid_auth_flows` and
`agentgrid_auth_sessions` plus prefixed functions/indexes. Browser roles cannot
access these tables; even the service role must use enumerated bounded RPCs.
Migration 008 exposes an authenticated, self-only workspace projection, including
the current onboarding gate, and replaces direct profile-update grants with bounded
self-only RPCs. Profile edits and visibility changes share a 60/hour limit. It
creates no profile, public activity or role.

Email request budgets are five/IP/hour, three/address/hour, 25 globally/day and
750 per fixed 30-day window. Google initiation is 60/IP/hour and 1,000 globally/day;
verification is 30/IP/hour and 1,000 globally/day. Global attempts bound new
pseudonym rows even when IPs change. These conservative application limits preserve
shared provider headroom; they may reduce availability during abuse and must be
reviewed against actual legitimate traffic before broad launch.

Only HMAC pseudonyms enter quotas. Sessions are capped at ten per identity, 1,000
creations/day and 1,500 active records globally. Expired temporary state is pruned
in bounded batches during authentication requests. No database job or paid service
is enabled. SQL locks protect session capacity across concurrent requests.

Encryption supports an active key and one retained decryption key. The MAC key is
separate and stable: rotating it deliberately invalidates application session and
flow identifiers as well as per-identity quotas. It never revokes PicMagic sessions.
Secrets must be independently random, server-only and absent from static builds.
The export scanner also detects individual encryption materials and refuses
symbolic links.

Future extraction recreates these schemas but must invalidate temporary flow/session
state and require deliberate managed reauthentication. Old project provider tokens
must not become sessions in the new project. Business profiles retain their stable
IDs through the separate managed-identity reassociation strategy.

## Evidence and limits

- Node acceptance covers encryption/purpose/origin/expiry/tampering/rotation,
  streamed body bounds, cookie/redirect constraints, CSRF, forged privileges,
  five guesses, replay, wrong verified identity, refresh races, revocation and
  provider failure. Synthetic fixtures never reach the catalogue or shared project.
- Pinned SDK transport tests exercise actual Supabase client behavior: PKCE
  verifier/challenge agreement, token-hash verification, remote `getUser`, local
  logout scope, fixed owned RPCs, user-bearer authority and malformed projections.
- Eight migrations pass disposable PostgreSQL actor/isolation/extraction checks.
  Self-only projection tests include another shared identity, forged metadata,
  current moderator authority and immediate suspension. Protected fixtures and
  default grants remain unchanged. Exact-main CI passed at `e141345`; the guarded
  operator applied migrations 007/008 and verified protected shared resources
  unchanged before/after each transaction. Eight migrations are now recorded.
- Production static export excludes unpublished resources/QA paths and privileged
  backend code. The separate server bundle compiles without reading credentials.
- Browser inspection of the sign-in entry found and corrected native-looking
  buttons. Subsequent 320/393/768/1024/1440px checks find no horizontal overflow;
  controls exceed 44px and keyboard focus is visible. Mobile introductory copy is
  reduced to keep the form closer. These are unavailable-state checks, not live
  sign-in proof. The real owner Google application flow now reaches the verified
  private workspace. It exposed an unsupported minimum refresh-token length;
  the managed provider issues 12-character opaque tokens. The correction retains
  remote verification and adds pinned-SDK regression/local cleanup checks.
  Real email-code delivery and verification also reach that workspace after
  correcting the managed hash shape (56 hexadecimal characters in this project,
  with the existing 64-character contract still supported and tested).
  Both real application Google and email sign-in are proven on localhost, not
  deployment. Logout clears private state, and direct workspace access then
  requires sign-in. Registration remains closed and creates no public profile.
  Profile editing, saves and complete authoring journeys remain open.
- Real signed-in workspace inspection at 320/393/768/1024/1440px finds no
  horizontal overflow. The logout control is 48px high. The mobile screenshot is
  stored in ignored local evidence; no email/code/session value is committed.
- Compiled workerd acceptance exercises actual AES-GCM cookie round-trips,
  secure flags, exact-origin/CSRF denial, private workspace denial, callback
  routing and static fallback using synthetic keys with outbound traffic denied.
  It uses the pinned vendor invocation matcher, including the trailing callback
  slash. Miniflare's loopback Host/Origin transport handling is restored only in
  the synthetic wrapper; production guard behavior is unchanged. This is a local
  runtime gate, not Cloudflare deployment or CPU-limit evidence.

## Remaining gates

1. Exact-head private CI for each workspace increment. The provider-shape correction
   and compiled runtime gate passed private PR/main CI and merged at `4698fd0`.
2. Real session-refresh/concurrency and cross-account HTTP journeys beyond the
   passing synthetic/database checks. Provider interoperability and the proven
   owner sign-in/logout flows alone do not establish all community behavior.
3. Reviewed community terms/privacy documents and deliberate consent configuration.
   Joining remains closed meanwhile. No acceptance or public creator identity is
   fabricated on the owner's behalf.
4. Complete draft authoring, synced saved-list UI, submission/version workspace and
   creator journeys, followed by full community moderation/fork/review/report flows.
5. Browser responsive/keyboard/error/reduced-motion checks, measured performance and
   accessibility across actual functional states, not only an unavailable screen.
6. Independently revocable server credential, protected preview/release workflow,
   Cloudflare runtime/quota measurement and production OAuth/legal/domain setup.
   No shared privileged key has been transmitted to Cloudflare or GitHub Actions.

The infrastructure-only deployment workflow intentionally refuses a repository
containing Functions. A separately guarded live application release is required;
adding server code must never silently broaden the old infrastructure release.

## Live saved-agent increment — 7 October 2026

- Migration 009 adds two self-only, authenticated RPCs over existing favorites.
  It creates no application table, profile, role, seed activity or shared Auth
  configuration. The disposable nine-migration acceptance gate passes actor
  isolation, 21-row lookahead, stable paging, immediate withdrawal, removable
  unavailable resources, forged metadata, suspension, protected fixtures and
  extraction/reassociation. Remote rollout remains a separate exact-main gate.
- The verified user bearer reads the fixed RPCs; strict projections refuse
  private fields and malformed/excessive results. GET parameters are bounded,
  mutation origin/CSRF is enforced, and private JSON remains no-store/noindex.
- `/saves/` provides live paging/removal and an unavailable-resource tombstone.
  Resource Save controls initiate identity lookup only on deliberate interaction;
  ordinary public page views make no private-session request. Saving is idempotent
  and only confirmed server success activates the control. No client token or
  private list is persisted locally.
- Private identity subtrees clear on document hiding/page freeze and require
  fresh verification on restoration. Real owner Google sign-in returns to
  `/saves/`. The owner has no community profile and receives explicit registration
  guidance. The local Save fixture similarly refuses to fabricate membership or
  write an invented save. Real logout followed by browser Back restores the
  signed-out saved-page gate, with no console errors.
- Signed-out entry checks at 320/393/768/1024/1440px show no horizontal overflow;
  primary controls are at least 48px high. Local mobile Lighthouse: performance
  98, accessibility 100, best practices 96; LCP 2.23s, TBT 60.5ms, CLS 0.0504.
  SEO 63 is intentional for this noindex private route. This is lab entry-state
  evidence, not member-list performance, field INP or production launch proof.
- Formatting/lint/strict typecheck, 61 Node plus 11 Python tests, production
  export and compiled workerd checks pass locally. Full real member save/remove,
  cross-device and withdrawal UI journeys remain acceptance gates after deliberate
  consent and genuine public-resource publication. Registration remains closed.

## Creator authoring increment — implementation and partial acceptance

- `/workspace/agent/` creates and edits owned private drafts. Query/return paths
  accept only one valid resource UUID; caller ownership/editorial authority is
  never accepted. Server reads use the verified user bearer plus an explicit
  owner predicate even for staff. Writes preserve editorial context, enforce the
  current revision and acknowledge only the expected next revision.
- Guided sections cover all portable definition fields except externally owned
  workflow artifacts/extension data, which use the advanced bounded import.
  Unfinished prose can be saved privately; security envelopes and explicit rights
  remain validated. Standard licenses are chosen deliberately, source terms
  cannot be replaced, and writes always require approval. Public structural
  readiness, editorial approval and real host tests remain distinct gates.
- A bounded root provider retains one draft and one profile edit buffer in tab
  memory across App Router navigation/history. It makes no identity request on
  public pages and uses no persistent storage. Concealment removes private
  subtrees; fresh identity, membership and ownership checks precede restoration.
  Other authoring links confirm replacement, while history navigation presents
  a held-draft recovery gate. Document unload warns about unsaved work. Explicit
  successful sign-out clears both buffers; aborted mutation acknowledgements
  cannot restore them. Clean acknowledged profile fields yield to live data.
- Local component QA covers section switching/retained edits, adding inputs,
  mandatory write approval, unfinished readiness and private acknowledgement.
  Mobile review found and corrected an intrinsic grid overflow. Adding/removing
  rows now moves keyboard focus; generated identifiers avoid surviving-row
  collisions. Browser reinspection verifies add-field focus, removal focus back
  to Add, section-heading focus, mandatory write approval, unselected reuse
  permissions and malformed-import refusal without changing existing fields.
- Disposable synthetic community acceptance uses the actual HTTP/identity and
  creator application code with explicitly labelled memory-only adapters. It
  cannot contact a real provider or reuse real credentials, and no synthetic
  profile/resource is written to shared infrastructure. Synthetic sign-in,
  owned create/read/save with actual revision acknowledgements, stale-save
  rejection and confirmation recovery pass in Chrome. Native-only tabs (without
  browser focus emulation) verify suspension/revocation concealment and fresh
  same-owner restoration. Reauthentication in a separate tab preserves the
  original unsaved definition. Back/Forward restores draft and profile edits;
  history to another resource presents the held-draft gate. Cancelled replacement
  retains both buffers. Successful sign-out followed by sign-in restores server
  data rather than discarded edits. Profile saving and a second-tab server
  update confirm clean acknowledged fields do not mask fresh server values.
- Formatting/lint/strict typecheck, all 65 Node/11 Python tests, production
  export and compiled workerd checks pass after the recovery changes. Previous
  PR 8 final head `20ae261` passed CI run `37632581023` and merged as `dc0b68c`.
  Layout checks at 320/393/768/1024/1440px find no document overflow
  and a 48px save target. Desktop/mobile screenshots show the refined header,
  connected section navigation and bounded editing layout. The authoring flow
  introduces no decorative motion; global reduced-motion protections remain.
  Real member/fork-inherited-license and full submission/version journeys remain
  required; synthetic acceptance is not a claim of production completion.
- Remote migration 009 passed exact-main CI and was applied with protected
  resources unchanged. The creator authoring increment adds no migration or
  managed authentication setting. Actual member acceptance waits for deliberate
  consent rather than seeding the owner's consent/profile.
- Extended disposable HTTP acceptance also passes new resource creation,
  confirmed read/save, stale revision rejection, profile update, suspension,
  resumption and session revocation. This is application-boundary acceptance with
  memory adapters; it does not substitute for browser interaction or real member
  journeys. Fresh Lighthouse logs contain no console errors.
- Optimized signed-out authoring-entry mobile lab: performance 99, accessibility
  100, best practices 96; LCP 2.27s, TBT 11ms, CLS 0. Private-route SEO 63 is
  intentional. The known static inline-script CSP work in `OPERATIONS.md` remains
  a public-launch gate. These measurements do not establish signed-in editor
  performance, field INP or visual acceptance across breakpoints.
- A separate isolated Lighthouse browser with disposable synthetic authentication
  confirms the signed-in editor rendered, with no console errors: performance
  98, accessibility 100, best practices 96; LCP 2.354s, TBT 14ms, CLS 0.0458.
  Private-route SEO 63 is intentional. The CSP issue remains the same documented
  launch gate. Neither lab establishes field INP, real provider latency or actual
  member acceptance. Reports and screenshots are ignored local evidence files.

## Immutable submission increment — local acceptance

- Additive migration 010 introduces an authenticated, self-only live history
  projection with 21-row lookahead. It exposes review status/reasons and frozen
  identifiers, never instruction/editorial bodies or another creator's ledger.
  Pending-review and highest-version gates are independent of the history page.
  No existing table, shared Auth setting or protected resource is altered.
- The saved definition must pass the complete portable schema and explicit use
  terms before submission. Verified user-bearer RPCs recheck membership, ownership,
  enabling, revision, a single pending request and strictly increasing versions.
  Creator APIs retain explicit owner filters even for staff. Submission/withdrawal
  acknowledgements require a matching owned immutable record and live state.
- `/workspace/versions/` separates draft saving, immutable submission and public
  publication. Unsaved working edits block submission; incomplete saved drafts
  receive readiness guidance. Freeze and withdrawal require deliberate UI
  confirmation. Withdrawal retains the version and its reason; its number cannot
  be reused. History never asserts that a pending submission is published.
- Disposable Chrome acceptance passes incomplete/unsaved gates, cancelled freeze,
  confirmed version 1.0.0 submission, withdrawal, unchanged frozen fingerprint,
  draft advancement and a separate pending 1.0.1 review. Native-only tabs prove
  suspension/revocation concealment and fresh identity restoration to the exact
  history return path. No synthetic record reaches real infrastructure.
- Additive migration 011 provides on-demand self-only frozen definitions. The
  download retains the immutable specification, original reuse terms and source
  reference alongside live review metadata; editorial/test evidence is excluded.
  Strict, bounded projections reject mismatched resources/versions and private
  extra fields. Anonymous, other-user, staff, non-member and suspended access are
  refused. No privileged creator API or client-selected authority is introduced.
- Chrome confirms earlier-version inspection/download while the saved draft has
  advanced. The downloaded JSON remains version 1.0.0, records its withdrawal,
  preserves its original fixture license and contains no editorial notes.
  A 22-version private synthetic history shows 20 rows then two, bounded paging,
  an off-page pending gate and keyboard focus on the history heading after either
  navigation direction. Closure retains history and disables submission;
  suspension conceals fields after revalidation; explicit recovery fetches fresh
  history with snapshots closed. No fixture is public or stored remotely.
- 320/393/768/1024/1440px checks find no horizontal overflow and a single H1;
  expanded JSON is height-bounded and download targets exceed 48px. The signed-in
  mobile lab reports performance 98, accessibility 100 and best practices 96;
  LCP 2.348s, TBT 30ms, CLS 0.005, with no console errors. A measured loading shift
  was corrected with server-rendered explanation and reserved live-workspace
  space. Private-route SEO 63 is intentional. The documented inline-script CSP
  work remains a launch gate. Lab evidence is not field INP/provider latency.
- Formatting/lint/typecheck, 71 Node/11 Python tests, production export and the
  768,236-byte compiled worker pass. Eleven disposable migrations pass actor
  denial, pagination, live withdrawal, protected fixtures and extraction/identity
  reassociation. PR 9 exact-head CI `37639656153` passed at `e372645` and merged
  as `f2ba23a`; exact-main CI `37639981912` passed. Guarded remote
  migrations 010/011 were applied from that clean main commit, with protected
  resources unchanged before and after each transaction. Read-only anonymous
  and shared non-member post-rollout checks pass; no real application rows were
  created. Full real member/community acceptance remains separate;
  registration stays closed pending legal information and deliberate consent.

## Private reporting increment — local acceptance

- Report writes accept target kind/ID, category and a bounded explanation only.
  Reporter identity, authorization, status and resolution are server-controlled.
  Existing database RPCs recheck active membership, target visibility, duplicate
  open reports and quotas. Responses are private/no-store/noindex.
- Migration 012 exposes only current reporter-owned status, explanation and
  moderation response, never another reporter's ledger. The administrator role
  does not override creator ownership. Anonymous/non-member/suspended/service
  access is denied; private target existence is concealed.
- Strict acknowledgement checks reject a missing, extra or mismatched record.
  A resolution that races confirmation returns its actual live state. Browser
  recovery says an unconfirmed report may have been received and links to the
  owner's live history. No automatic write retry or false success is used.
- Chrome confirms anonymous gating, a real local report receipt, live resolution
  refresh with heading focus, uncertain acknowledgement retention, history
  recovery and duplicate-open denial. Root-held text survives App Router history;
  permission resets on remount. Native sign-out cancellation retains the text;
  confirmed sign-out removes private state. Suspended-member history removes all
  report details after revalidation and recovers through explicit reconnect.
- History remains within 320/393/768/1024/1440px viewports. The isolated signed-in
  mobile Lighthouse lab scores 98 performance / 100 accessibility / 96 best
  practices, LCP 2.342s, TBT 26ms, CLS 0.00293 and no console errors.
  Private noindex SEO 63 is expected; static inline-script CSP work remains
  a production gate. This is not field INP, real provider latency or public
  community activity. Evidence captures are ignored local files.
- Final formatting/lint/strict typecheck, 75 Node/11 Python tests, production
  static export and compiled worker acceptance pass. Twelve disposable migrations
  pass actor/isolation/extraction tests. Private CI and migration 012 remote
  rollout remain pending. No managed authentication or protected application setting
  was changed. Full reporting/moderation production acceptance remains open.
