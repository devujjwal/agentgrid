# Activation preparation — execution stays disabled

The environment example names the required configuration, callbacks, secrets and bindings without containing credentials. Every flag and spending limit remains zero. The SQL preflight is read-only. Nothing here creates an account, grants access, provisions infrastructure, deploys a Worker, changes a remote policy or initiates a render/post.

## Prepare a disabled release

1. Review PR #62, including owned migrations 032–035, before merging or deploying. Apply migrations only to the dedicated AgentGrid project through the established deployment procedure. Do not apply them to shared project tables. Keep all five environment flags at `0`, all database policies false and all spending allowances zero throughout provisioning.
2. Provision `AGENTGRID_MEDIA_BUCKET` as a private object bucket, with no public domain or public-access route. Bind it to Pages and the execution Worker. Bind `AGENTGRID_EXECUTION_QUEUE` to Pages and the execution Worker; provision the existing execution/dead-letter queues. The Worker configuration includes a cron scan, but the global, publishing and scheduler flags disable it before any queue or database call.
3. Build and scan the ffprobe sidecar image, pin its image digest, and place it behind authenticated private TLS ingress. Use read-only container files, a writable temporary directory, CPU/memory limits and denied outbound networking. Configure `AGENTGRID_VIDEO_PROBE_ORIGIN` and a separate `AGENTGRID_PROBE_KEY`.
4. Create/register the Meta and LinkedIn applications under the owner's provider accounts. Use the exact callbacks from the example. Obtain applicable app review/product permissions. Meta supports controlled Facebook Pages and linked professional Instagram accounts. LinkedIn requires member write and restricted member read permission for delivery verification. Supply client IDs and secrets directly in the deployment secret manager. Account verification, provider agreements and permission grants must be completed by the account owner where required.
5. Supply dedicated, different 32-byte hex keys for connection-token encryption and media-grant encryption. Provide the renderer credential, a reviewed supported Meta version, approved renderer output hosts and a versioned render rate ceiling. Keep all secret values out of this file, chat, Git, analytics and logs. The example deliberately leaves all provider values blank.
6. Bind an independently trusted billing reconciler as `AGENTGRID_RENDER_BILLING`; it must implement `verifiedCost(taskId)` from actual provider billing evidence. The Worker passes this binding into `verifiedBilledCost`. Renderer estimates are cost ceilings, not billing receipts. Until actual usage evidence is available, completed renders remain pending and reservations stay held.
7. Run the read-only preflight after provisioning. Check disabled policies, zero allowances, private bindings, deployment health, cookie/CSRF behavior, account revocation and queue wiring. Run mock tests and the local workspace acceptance fixture; do not substitute them for a real-provider pilot.

## Later activation sequence — requires a new instruction

Prepare a concrete pilot proposal listing its owner-controlled accounts, exact spending allowances, provider privileges, flags/policies to change and approved publication destinations. No nonzero allowance has been authorized; no pilot is activated by this preparation.

A future staged pilot should first validate OAuth with publication disabled, then text/video execution within an explicitly approved budget, then an owner-approved post to each authorized test destination. Open general member execution only after those checks pass. Keep the ability to disable connections, revoke tokens and cancel queued work available throughout. Turning off execution cannot retract an external request already sent; reconcile in-flight or uncertain outcomes before changing reservations or retrying anything.

## Workspace behavior prepared in this phase

- Account names come from provider-verified discovery. A new connection cannot post. Members explicitly enable a destination with its current name, platform and token expiry; stale selections and incomplete scopes are rejected.
- A storyboard is saved from an owned completed text run, with a pinned renderer identity and exact maximum charge. Generation starts only after cost approval and an atomic budget reservation.
- Private finished video playback precedes destination-specific captions and an exact schedule preview. Every changed preview needs its own approval. The user must cancel an older approved schedule before replacing it.
- Due approved publications are scanned from the private ledger. A failed enqueue is recovered on a later scan; duplicate messages cannot claim the same delivery twice. Revoked/expired connections, expired approvals and inactive members are excluded and rechecked at dispatch.
- A processing delay can continue from its saved upload under the still-valid approval. Unknown publish outcomes use readback/reconciliation; they are never automatically reposted.
