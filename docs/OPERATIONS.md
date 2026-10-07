# Phase 0 operations and acceptance

## Verified ownership

- Personal GitHub login: `devujjwal`.
- Connected GitHub profile email: `devujjwal1989@gmail.com`.
- Personal CLI credential independently resolves to `devujjwal`.
- Account has no display name. Local commit name uses the verified login.
- Remote is the private repository `devujjwal/agentgrid`.
- Global work email remains `ujjwal.paul@timesinternet.in`.
- Global configuration checksum baseline is stored privately in `.git`.
- GitHub CLI's active work account has not been switched.

The local credential helper explicitly selects the stored personal CLI credential
and refuses every destination other than this repository. It does not alter
global credentials or persist tokens in source files.

## Local commands

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm dev
pnpm verify:git
pnpm verify:push
```

Local development uses port 3027 to avoid existing work applications. The current
page is an infrastructure proof, blocked from indexing. It is not a completed
visual system. Do not point the production domain at this build.

## Provider prerequisites

Cloudflare and Resend personal browser login is complete. Cloudflare email is
verified. Google Cloud personal sign-in is complete; AgentGrid's separate OAuth
project has no linked billing account. Required OAuth policy acceptance and scoped
email credential creation were authorized and completed. Google web-client
credential/configuration approval was subsequently granted and setup is verified.
Do not paste credentials into
chat, tracked files, or workflow logs. New account terms must be completed by the
account owner or explicitly authorized at the acceptance step. No paid plan or
automatic recharge is authorized.

Supabase's authenticated account reports that `devujjwal` has reached the two
active free project limit. Its existing organization is managed through Vercel
Marketplace Billing. Do not pause, delete, repurpose, or upgrade existing projects
without the owner's explicit choice. Creating another free organization does not
bypass the per-owner project limit.

The owner subsequently authorized sharing the existing PicMagic project as
physical infrastructure to avoid a paid project. AgentGrid remains logically
independent: prefix every owned database/storage resource with `agentgrid_`,
inspect the existing schema/auth before changes, preserve all existing PicMagic
resources and policies, and do not couple AgentGrid authorization to PicMagic
roles or profiles. Shared authentication needs a cross-application access audit.
If existing PicMagic policies would grant an AgentGrid login access to private
PicMagic data, stop before enabling public AgentGrid authentication and explain
the issue; do not silently modify protected policies.

## Phase 0 remaining evidence

- Email delivery and Google PKCE interoperability are verified. Complete public
  authentication challenge/session/abuse and cross-account journeys remain Phase 4
  requirements. Preserve PicMagic SMTP/templates.
- Secure access for future previews containing unpublished resources. Noindex is
  crawler guidance, not access control. The current Pages proof contains no private data.
- CI-gated release deployment credential and workflow, with main-only production
  deploy and deliberate environment configuration.

Do not mark Phase 0 complete while these are pending.

Cloudflare static delivery and private-repository GitHub CI are already verified.
Supabase connectivity, schema inventory, and initial cross-application RLS denial
checks are verified. See the implementation ledger and shared-backend guide.

## Verified email setup

Resend domain `mail.agentgrid.me` is verified in Tokyo (`ap-northeast-1`). Current
provider instructions use a DKIM TXT plus two CNAMEs:

| Type  | Host relative to agentgrid.me | Destination                                          |
| ----- | ----------------------------- | ---------------------------------------------------- |
| TXT   | `resend._domainkey.mail`      | Public DKIM value supplied by this new Resend domain |
| CNAME | `rsend.mail`                  | `rsend-apne1.forge.rmta.net`                         |
| CNAME | `send.mail`                   | `send.forge.rmta.net`                                |

The three additions are saved in GoDaddy and resolve at the authoritative server.
No existing DNS record was replaced; the website's parked apex remains untouched.
Receiving is off; TLS is enforced for this domain only.
Do not infer old provider MX/SPF instructions; use the records shown for this domain.
Owner authorized email authority and key creation. `agentgrid_transactional` is
issued with Sending access restricted to `mail.agentgrid.me`, verified on its
detail page. Other keys/domains remain unchanged. The key is in ignored
`.env.agentgrid.local` with mode 0600; it has not yet been supplied to Cloudflare.

`backend/email/resend.ts` is a server transport, never a public route. Provider
acceptance does not mean inbox delivery; inspect delivery events separately.
The explicit live proof command sends only to the owner's test alias, keeps codes
and sessions in memory, checks consumption/replay, and signs out locally:

```sh
NODE_USE_SYSTEM_CA=1 node --env-file=.env.agentgrid.local scripts/verify-auth-delivery.mjs --send-owner-test
```

Never run this in CI or against arbitrary recipients. The fixture is a private
managed-auth identity, not a creator/profile/activity seed. The verified SDK is
pinned to 2.117.2. System CA trust is used normally; TLS validation is never disabled.
Existing managed Supabase public/secret keys are stored locally for this test;
no key was issued, rotated, disabled, or transmitted to another hosting provider.
Before backend deployment, use an independently revocable AgentGrid-owned secret
and explicitly authorize its privileged storage/transmission. That key still has
project-wide privileges; a separate name does not restrict its database access.

## Verified Google setup

The owner-approved Google client is stored only in ignored mode-0600 local setup
configuration and Supabase's provider configuration. It is never a static build
input. `.env.example` documents the setup-only names without values.

`scripts/configure-google-auth.py` is a one-time guarded operator tool: it refuses
CI, existing Google credentials, protected auth drift, or replacement of its private
transition evidence. It changes only Google enablement/client ID/secret and one
exact localhost callback. No original fingerprint is reset to accept the change.
`--record-approved-result` makes no remote mutation; it records only the matching
authorized result after inspecting an opaque provider response.

`scripts/oauth-proof-server.mjs --owner-google-test` runs only at localhost:3027.
It binds PKCE to a short-lived in-memory flow with HttpOnly/SameSite cookie, verifies
POST Origin/CSRF and the returned identity, consumes callbacks once, and signs out
locally. Codes/tokens/sessions never appear in HTML or logs. A real Chrome proof
passed. The server is intentionally separate from Next.js and must never be
deployed or treated as the production auth implementation.

Google remains External/Testing with the owner as its sole test user. Production
branding, policy URLs and exact production callback registration are launch work.
Keep the shared PicMagic Site URL and existing callbacks unchanged. Adding future
callbacks requires a separately recorded exact delta; the initial guard does not
silently allow new origins or wildcard redirects.

## Public export boundary

The export gate checks required files, source maps, common credential signatures,
and configured privileged values. It is a defense-in-depth check, not a complete
secret scanner. It must be extended with publication allowlists and private-data
tests when content publishing is implemented.

The infrastructure proof uses noindex headers and a restrictive CSP. Next.js static
hydration requires inline bootstrap scripts, so this initial policy includes
`unsafe-inline` for scripts. Replace it with build-derived CSP hashes before public
launch, and add only the exact Supabase/analytics origins required. CSP and headers
are served by Pages via `_headers`, not by Next.js runtime configuration.

## Deployment policy

No automatic production-domain deployment is configured. The owner approved an
account-owned `agentgrid_ci_deploy` token with Pages Write only, expiring January
6, 2027. Cloudflare scopes this token to the personal account's Pages resources,
not a single project. A compromised credential could affect other Pages projects;
destination guards are additional safeguards, not a provider permission boundary.
No DNS, billing or broader Worker permission is included. The token is stored in
ignored mode-0600 local configuration and encrypted secrets in private
`devujjwal/agentgrid` only. No Supabase, Google or Resend secret was sent to GitHub.

The manually dispatched `Deploy infrastructure proof` workflow validates the
exact main commit, audits production dependencies, and runs all checks before
supplying the deployment credential to its final step. The operator supplies the
full commit SHA; branch/repository/event/checkout/dirty-state checks must all pass.
The wrapper accepts only the existing `agentgrid-infrastructure` Pages project,
its main production branch and its sole pages.dev domain. Product-domain changes,
backend bundles and credential-bearing exports are rejected. It validates the
provider receipt and HTTP content/security/robots/404 behavior after deployment.
The pinned Wrangler CLI is development tooling, excluded from client bundles.
Metrics/error-report transmission is disabled; raw CLI/provider errors and
temporary debug records are not uploaded to Actions artifacts.

Remote infrastructure builds contain only the public proof. Local development
binds to `127.0.0.1`, rather than exposing draft work to the network. Keep unpublished
content previews local until live authenticated workspace previews are tested;
private data must never enter a public static artifact. Noindex alone is not
access control. Product releases require publication allowlists, recovery and
launch gates before this workflow can be extended to the production destination.
Do not enable direct Git auto-deployment that bypasses CI.

## Dependency compatibility and security assessment

Pinned framework: Next.js 16.4.0 and React 19.3.0. TypeScript 6.0.3 is chosen because
the current TypeScript ESLint parser does not support TypeScript 7. ESLint 10 uses
its compatible TypeScript, React Hooks, and Next.js plugins directly; the current
Next.js preset pulls older plugins whose peer ranges do not support ESLint 10.
Exact versions and the lockfile are committed; peer dependency mismatches are errors.

Production audit on 7 October 2026: no known vulnerabilities. Full audit identifies
GHSA-vfj7-8cjw-p6xm in the development-only chain
`@next/eslint-plugin-next -> fast-glob -> micromatch -> braces`. No patched version
is available. The vulnerability requires adversarial deeply nested glob patterns.
Source inspection shows the plugin only invokes this glob processing when
`settings.next.rootDir` is supplied; AgentGrid does not supply this setting.
The dependency is not part of the public static application, and community input
never enters lint configuration. This is a documented development-tool exception,
not a claim that the full dependency tree has no advisories. Reassess on plugin
updates or lint-configuration changes; never use untrusted glob patterns.

Advisory: https://github.com/advisories/GHSA-vfj7-8cjw-p6xm.

The pinned Wrangler 4.148.0 CLI introduced local Miniflare `sharp` 0.35.4.
The expanded audit detected GHSA-wq5f-xc86-pv6w before any CI deployment. A narrow
`miniflare>sharp` override pins the patched 0.35.5 (already used by Next.js).
This fixes the deployment-tool chain without adding image processing to the
public application. Reassess/remove the override when Miniflare updates its pin.
CI now audits both production and the full tree. Its only exception is the exact
previously assessed unpatched `braces` 3.0.3 lint path. New paths, available fixes,
unknown advisories and incomplete audit responses block the build.

Patched advisory: https://github.com/advisories/GHSA-wq5f-xc86-pv6w.
