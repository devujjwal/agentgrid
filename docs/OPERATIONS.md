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

Cloudflare and Resend need personal browser login. Do not paste credentials into
chat, tracked files, or workflow logs. New account terms must be completed by the
account owner. No paid plan or automatic recharge is authorized.

Supabase's authenticated account reports that `devujjwal` has reached the two
active free project limit. Its existing organization is managed through Vercel
Marketplace Billing. Do not pause, delete, repurpose, or upgrade existing projects
without the owner's explicit choice. Creating another free organization does not
bypass the per-owner project limit.

After an authorized slot is available, provision AgentGrid separately from other
applications. Use a dedicated project and tightly controlled roles. Never share
another application's database or expose its credentials to AgentGrid.

## Phase 0 must still prove

- Cloudflare account's free Pages allowance and private-repository deployment.
- Supabase dedicated project capacity and authenticated connectivity.
- Production SMTP sending domain and real OTP delivery.
- Google OAuth ownership and callback configuration.
- Static export deployment and secure preview access.
- CI passes remotely without paid runners/add-ons.

Do not mark Phase 0 complete while these are pending.

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

No automatic production deploy is configured in Phase 0. A release must come from
tested `main`, with a separate production environment and owner-approved secrets.
Do not enable direct Git auto-deployment that bypasses CI. Release artifacts must
be checked and publication must remain recoverable before launch.

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
