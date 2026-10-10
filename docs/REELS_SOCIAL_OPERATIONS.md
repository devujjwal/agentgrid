# Reel and social foundation — execution stays disabled

This phase implements the durable control plane and a planning interface. It does
not integrate a live video renderer or social API. No paid generation, OAuth grant,
remote media fetch, production migration, queue schedule or real post has occurred.
The owner explicitly requested that execution remain disabled and allowances stay
at zero. Do not enable any layer as part of deploying this code.

## Implemented

- `/workspace/reels/` provides manual title, narration and storyboard planning,
  portrait format and a 30-second bound. Drafts stay in React memory, have no
  browser persistence and are discarded on navigation/session unmount. The
  interface explicitly identifies rendering and social connections as unavailable.
- Strict reel snapshots bind a successful private source run, reviewed plan,
  provider revision, cost cap and owner. Idempotent preparation rejects edits under
  the same key. Atomic dispatch claims allow at most one task submission.
- Migration 033 stores reels, private asset manifests, encrypted social connection
  records, exact publication previews and a separate ledger per destination.
  All tables use RLS with direct access revoked, including `service_role`. The
  fixed server RPC resolves an active profile from the verified subject.
- Video claims reserve the existing member and site allowances with the same lock
  order as text execution. Daily attempt/concurrency controls are shared. Unknown
  charges stay reserved; only verified usage settles and releases the unused amount.
- Known task IDs are immutable and may be polled safely. A lost submit result never
  permits automatic resubmission. Cancellation discards the arriving asset record
  while still settling verified usage. No cancellation guarantees a provider refund.
- The private bucket adapter validates bounded bytes, MP4 signature, trusted
  decoder results (720 × 1280, H.264, optional AAC, at most 30 seconds), owner/run
  object keys and SHA-256 readback. It creates no public bucket or arbitrary URL
  fetch. A trusted decoder implementation is a prerequisite, not supplied metadata.
- Social token envelopes use AES-GCM with owner, connection and platform as
  authenticated context. Expired, swapped and malformed secrets fail closed. No
  account registration/credential exchange is exposed by this change.
- Delivery requires the exact media checksum, caption, connection and schedule
  approval. Claim rechecks flags, due time, expiry and revocation transactionally.
  Destinations settle independently; successful destinations are never retried.
- A returned candidate post ID is saved before readback. Readback failure becomes
  uncertain and cannot repost. A separate reconciliation function can verify an
  existing candidate without calling publish. Without a candidate, an operator
  must investigate; no automatic retry or guessed success is available.
- Disconnect erases the stored token envelope and cancels pending deliveries.
  An already-started external request may complete; keep its delivery evidence
  and reconcile it rather than silently claiming cancellation.

## Flags and deployment boundary

`mediaCapabilities()` requires `AGENTGRID_EXECUTION_ENABLED=1` plus the separate
`AGENTGRID_REEL_GENERATION_ENABLED=1` or `AGENTGRID_SOCIAL_PUBLISHING_ENABLED=1`.
Missing flags and any value other than the exact string `1` mean disabled.
Database `agentgrid_media_policy.render_enabled` and `publish_enabled` default
false and require the existing execution policy to be enabled too. Deployments
must preserve the owner's disabled state and zero allowances.

This change provides server adapters and tested orchestration ports. It deliberately
has no video-provider implementation, social-publisher implementation, browser
OAuth endpoint, media HTTP endpoint or scheduled media Worker entry point. Creating
records requires the privileged server RPC; the manual planner does not call it.
The migrations are exercised only on disposable local PostgreSQL. Live installation
must follow `SHARED_BACKEND.md` and compare protected project fingerprints.

## Remaining integration work

1. Implement one renderer against a currently verified model/API, with a provider
   quote that bounds the complete narration, scenes and composition cost. A single
   text-to-video clip is insufficient proof of a complete narrated reel.
2. Wire durable Workflows/polling using saved task IDs. Bound polling count/deadline
   and do not wrap task submission in an automatic retry. Record all orphan objects
   for cleanup, particularly cancellation racing with storage or settlement.
3. Provision a private AgentGrid bucket, trusted video decoder/transcoder and
   authenticated streaming/download routes. Define storage quotas, asset expiry,
   deletion, incomplete upload cleanup and support erasure before activation.
4. Implement owner-scoped, one-use OAuth state bound to the verified session,
   exact callbacks and minimum permissions. Obtain Meta/LinkedIn app eligibility
   and review. Resolve account identity from the provider, never browser IDs.
   Use a dedicated encryption secret with a planned key version/rotation process.
5. Implement platform upload/container/publish/readback adapters. Check current
   caption/media restrictions, connection expiry and destination identity. Any
   provider-fetchable URL must come from a bounded, expiring media grant for that
   delivery, never an arbitrary user URL or permanent public bucket.
6. Add final media preview, destination selection, caption editing, UTC schedule
   review and exact confirmation endpoints with session/CSRF checks. Manual batch
   approval is supported by the ledger. Recurring unattended posting requires a
   separate revocable authorization design.
7. Add owner history, cancellation and moderation/abuse controls, update privacy
   disclosures, then perform real acceptance only after the owner separately
   authorizes activation/spend and consents to the test destinations.

## No-call acceptance

`tests/reels-social.test.mjs` uses synthetic providers, media bytes/decoder and
social accounts. It exercises disabled gates, bounded plans/quotes, idempotency,
concurrent claims, task persistence failure, safe polling, ownership, cancellation,
revocation, exact approval, uncertain readback, reconciliation and token encryption.
`supabase/agentgrid/tests/reels_social.sql` exercises the real transactions, direct
access denial, shared budgets, immutable task IDs, independent destinations and
policy fail-closed behavior. Synthetic evidence is not proof of a rendered video,
public post or platform approval.

Reference checks on 10 October 2026: [Runway task/output documentation](https://docs.dev.runwayml.com/assets/outputs/)
and [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api).
Meta's official publishing page returned HTTP 429; verify current requirements
when implementing its adapter. These references do not establish platform eligibility.
