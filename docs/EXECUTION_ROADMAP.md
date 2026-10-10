# Run agents in AgentGrid

## Product outcome

A member selects a supported agent, enters a brief, sees its processing provider
and cost limit, and starts a private run. For a reel workflow the run produces a
script, video and channel-specific captions. The member previews the final media,
selects connected destinations and approves a schedule. AgentGrid delivers each
approved post and shows separate success, failure or uncertain status per platform.

Existing instruction resources remain usable in external platforms. Publication
does not automatically authorize hosted execution, account access or tool use.
The first hosted execution pilot uses an explicit reviewed allowlist of first-party,
tool-free resources. Review license grants and provider compatibility per version.

## Architecture decisions

- Keep Next.js static export for the catalogue and authenticated browser workspace.
  Run creation, provider calls, OAuth exchanges and secrets live behind the existing
  Worker session, CSRF and active-member boundary.
- Store private run records in AgentGrid-owned tables with owner-scoped RPCs and RLS.
  Add no shared-auth changes, global grants or scheduler jobs to the shared Supabase
  project. Follow `SHARED_BACKEND.md`; test non-AgentGrid access independently.
- Use a separate Cloudflare execution Worker with Workflows for long-running jobs,
  durable steps and provider polling. Pages requests enqueue and return; they must
  not keep video generation alive with request-lifetime callbacks.
- Use a private AgentGrid R2 bucket for media and short-lived owner download links.
  A publisher may obtain a bounded provider-fetchable media URL where required.
  Never accept arbitrary URL fetches, user-supplied tool endpoints or code execution.
- Separate text, video and social provider adapters. Runway is a candidate for the
  video pilot; validate current models, availability and price before committing.
  Social adapters use Meta Instagram/Facebook and LinkedIn official publishing APIs.
  Eligibility, app review, permissions and video formats differ by platform.
- Encrypt social tokens server-side; use state-bound OAuth with exact callbacks.
  Account selection comes from verified provider identity, not a submitted account ID.
  Disconnect revokes access where supported and cancels pending deliveries.
- Reserve a bounded generation budget transactionally before dispatch. Credits,
  provider quotas and concurrency limits prevent unrestricted public spend. Token
  limits alone do not provide a billing guarantee. No paid calls in the foundation.
- Pin resource instructions, provider/model, input, media checksum, caption,
  account and schedule. Exact preview approval is required for each batch. Recurring
  unattended campaigns need a separate, revocable scoped authorization design.
- Treat unknown outcomes as requiring reconciliation. A timeout after a publish
  call must not trigger another post. Use provider IDs/idempotency where supported,
  atomic claims and delivery-ledger reconciliation before retrying.
- Keep prompts, results, media, OAuth codes and tokens out of GA, public profiles,
  public export, routine logs and error responses. Define retention and deletion for
  private runs before rollout; update privacy disclosures before provider activation.

## Delivery sequence and acceptance gates

1. **Runtime foundation — this change.** Implement bounded run contracts, immutable
   execution fingerprints, owner-scoped storage interface, atomic execution claims,
   unknown-outcome handling, cancellation semantics and exact publication approvals.
   Test concurrency, ownership, edited approvals and provider failures without making
   external calls. This library is not mounted to HTTP or enabled on production.
2. **Direct text runs.** Add versioned AgentGrid migrations for runs, budget
   reservations and audit events; implement the durable store and one server-side
   text adapter. Add authenticated prepare/confirm/status/cancel endpoints and a
   private workspace runner. Include provider/input disclosure, cost cap, empty,
   loading, failure and cancellation states. Verify real host behavior for each
   execution-approved resource. Gate activation behind separate environment flags.
3. **Reel generation.** Implement script/storyboard and video job adapters, private
   media storage, verified webhooks or polling, output validation, preview, download
   and regenerate. Start with one video provider and one portrait format; record
   actual generation cost. Existing Transcript Clip Planner only produces edit plans.
4. **Social connections and manual publish.** Add Meta and LinkedIn developer apps,
   callbacks and minimally scoped publishing permissions. Complete required platform
   reviews. Ship connection status/expiry/disconnect and final preview approval.
   Test each destination with consenting test accounts and actual post readback.
   A successful API request is insufficient proof of public post delivery.
5. **Scheduled multi-platform publishing.** Add durable schedules, revocation checks,
   per-destination delivery states and duplicate prevention. Handle partial success
   without retrying successful destinations. Test expired credentials, rate limits,
   cancelled schedules, edited media, delayed jobs and ambiguous provider outcomes.
6. **Public activation.** Pass isolation, provider spend/concurrency, member privacy,
   moderation/abuse, mobile accessibility and real end-to-end acceptance gates.
   Pilot with owner-controlled accounts before opening execution to all members.

## Configuration and decisions still needed

The first implementation does not require credentials or new service permissions.
Real execution needs an approved provider/model, funded provider account and a
per-member spending policy; reel generation also needs a video provider credential.
Production scheduling needs provisioned Workflows/R2 resources. Social publishing
needs platform developer apps, their approved OAuth permissions, and consenting
connected accounts. Human entry is required when creating new credentials in UI.
Do not describe these integrations as active until actual acceptance succeeds.

## Current implementation limits

`backend/execution` is a server library with test adapters only. Its `RunStore`
contract requires transactional owner isolation, unique owner/idempotency keys,
queued-to-running compare-and-set, and cancellation-preserving completion. There
is no production persistence adapter, billing reservation, provider credential,
runtime route, Run button, rendered media or posting adapter in this change.
No schema or live configuration is changed. The already-live catalogue/community
continues using its existing execution behavior until the next slice is verified.

## Provider references checked 10 October 2026

- [Cloudflare durable Workflows](https://developers.cloudflare.com/workflows/get-started/guide/)
- [Runway API](https://docs.dev.runwayml.com/guides/using-the-api/)
- [Meta Instagram publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/)
- [Meta Facebook Reels publishing](https://developers.facebook.com/docs/video-api/guides/reels-publishing/)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api)

Cloudflare, Runway and LinkedIn documentation was readable in this session. Meta
documentation could not be fetched; verify its current requirements directly during
the connector phase rather than relying on remembered scopes or account eligibility.
