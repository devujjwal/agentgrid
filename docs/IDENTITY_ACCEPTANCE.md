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

1. Exact-head private CI for the provider-shape correction and compiled runtime gate.
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
