# Aggregate product measurements

Collection is **off** by default. No analytics provider, paid plan or tracking
credential has been added. The collector uses the existing AgentGrid backend and
an isolated `agentgrid_analytics_daily` table. Migration 027 is additive and must
pass the existing protected-schema rollout before use. It has no application or
identity foreign keys into PicMagic.

## What can be measured

- Public directory landing-page views: an enumerated page label, never a URL.
- Settled searches: resource kind and a result-count band. No query text.
- Published agent views, explicit platform selections, successful clipboard
  writes and definition-download initiation: exact public resource/version IDs
  and a declared platform where relevant.

Downloading records initiation, not proof of a completed download. Copying does
not mean installation. Page observations do not mean unique people. Search counts
represent settled results after 1.5 seconds without further input, not each
keystroke. Existing saves, forks and moderation records remain authoritative
business data; this collector does not duplicate them or expose public counters.
Affiliate/ad events remain absent because those products are not enabled.

No visitor identifier, account ID, cookie, raw IP, fingerprint, full path, referrer
or query is stored by this measurement pipeline. Cloudflare and Supabase still
process ordinary network requests under their own policies; this does not imply
that the infrastructure sees no connection information. The client uses
credentials omitted and no-referrer, respects DNT and Global Privacy Control,
never retries, retains no persistent queue and sends at most 20 observations per
document lifetime. Local/private previews never send measurements. Private
workspace, sign-in and creator routes are not instrumented.

## Validation and abuse limits

The API checks the exact origin/path, JSON type and a 512-byte streaming bound.
Its closed schema rejects extra fields. The database independently checks the
vocabulary, public release/version and declared platform. Anonymous/member JWTs
cannot execute analytics RPCs or read/write the table. Only the backend service
role may call the constrained recorder, summary and expiry functions. Existing
member/moderator/admin roles gain no analytics or PicMagic data access.

A serialized 2,000-observation ceiling per UTC date bounds accepted writes, with
no visitor-rate identifiers. Approximate counts can be forged or exhausted by
an attacker and must never determine payouts, rankings, advertising invoices or
security decisions. This ceiling does not cap Worker invocations or database
requests: provider free-tier quotas and endpoint abuse still need monitoring.
Collection can be disabled immediately using the server switch. No automatic
upgrade, refill, retry loop or paid traffic mitigation is configured.

## Enablement and retention

Both gates are required: build `NEXT_PUBLIC_AGENTGRID_ANALYTICS=1`, runtime
`AGENTGRID_ANALYTICS_ENABLED=1`. Defaults are zero. Enable only after the privacy
notice describes the actual behavior, the deployed collector passes acceptance,
and operator quota/retention checks are in place. The current app remains closed
for real onboarding and these gates remain off. Staging/local code tests use
synthetic transport/database fixtures; no real visitor events are seeded.

Counts are queried for the last 30 UTC calendar dates. A write transaction prunes
older rows, and `agentgrid_analytics_prune()` can remove them independently. When
traffic stops, expired aggregates remain physically stored until the next prune;
there is no claim of guaranteed daily deletion. Before enabling collection,
include an operator prune in the existing maintenance schedule or add a reviewed
free scheduled mechanism. Do not silently introduce another service or database
extension to provide that schedule. No raw personal measurement data is retained.

For explicitly configured local operator environments:

```sh
node scripts/analytics-report.mjs report
node scripts/analytics-report.mjs prune
```

The script discovers no credentials and reads no local secret files. Use the
approved private configuration process; never paste credentials into shell
history or logs. Reports show bounded daily/event aggregates, not raw resource
dimensions or provider diagnostics. The prune action removes expired aggregates
only. Both commands refuse CI, so private credentials are not needed by tests.

## Acceptance

Test closed payloads, cross-origin denial, GPC/DNT, disabled state, bounded
transport, provider failure and credential isolation. Database acceptance must
cover public/current version success, wrong version/platform and withdrawn
resource rejection, direct-role denial, quota enforcement, expiry and protected
PicMagic fixtures. Production validation must additionally inspect actual browser
requests, provider invocation volume and the runtime kill switch before enabling.
