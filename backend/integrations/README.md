# Disabled video and social integrations

This phase adds Shotstack composition, a private ffprobe decoder, session-bound Meta/LinkedIn OAuth, and Instagram, Facebook Page and LinkedIn member video publishers. `dispatchMediaJob` joins the adapters to the existing private reel/delivery ledger and shared spending controls. The execution queue accepts explicit `render`, `inspect`, `publish`, `resume` and `reconcile` jobs. Media jobs are acknowledged after one attempt; an ambiguous outcome requires reconciliation rather than automatic redelivery.

**All execution, rendering, OAuth and publishing flags stay `0`.** Migrations 034–035 also leave `oauth_enabled=false`. No migration, credential provisioning, paid render, OAuth exchange or live post was performed. The existing manual reel planner remains available; execution controls remain disabled.

## Implemented boundaries

- Shotstack v1 receives timed image scenes, plain text overlays and narrated audio, with explicit `nano-banana-2` and `polly-neural` model choices. Output is 720×1280 MP4 at 30 FPS. Narration is limited to two words per second. Quotes require a reviewed rate ceiling with a revision; no price is invented or fetched at run time.
- Known render task IDs are polled without resubmission. A completed render stays pending until independently verified billing evidence exists. The adapter never substitutes its estimate for actual usage. Output download hosts require an explicit allowlist; credentials are omitted on downloads and redirects are refused.
- `backend/video-probe/server.py` runs ffprobe against temporary local bytes with network protocols disabled, a 20-second decoder timeout and two concurrent slots. The Worker validates H.264/AAC, dimensions, duration, file size and checksum before private bucket storage. Temporary files are removed after success or failure.
- OAuth starts require an authenticated active member and the existing CSRF check. One-use, ten-minute state binds owner, current session, platform and fixed callback. Tokens are encrypted with AES-GCM and bound to owner/connection/platform. Meta discovery includes only controlled Facebook Pages with content-management tasks and linked professional Instagram accounts. LinkedIn requires member write **and read** permission. New connections have publishing disabled; OAuth never grants posting approval.
- Instagram receives a short-lived encrypted media grant. The media route checks execution flags, expiry, current connection, owner, ready ledger asset and checksum on every fetch. It creates no permanent public object URL. Facebook uploads the exact private bytes; LinkedIn uploads validated contiguous byte ranges, saves the video URN, finalizes with ETags and checks availability.
- Before any upload mutation, a durable receipt atomically binds delivery, connection, asset checksum and exact caption. Stages cannot skip, repeat or replace the uploaded ID. A lost response or processing delay becomes uncertain. An explicit `resume` job polls the saved upload and uses an atomic transition to make the first publish only if the original approval is still valid. A saved publishing/post receipt is never republished. Readback verifies the current owned destination and exact caption, and LinkedIn also verifies the uploaded video URN.
- Direct table access is revoked for anonymous, authenticated and service roles. Only fixed subject-scoped server RPCs can access OAuth state, encrypted credentials and receipts. Provider errors are sanitized; no credentials enter analytics or logs.

## Before a separately approved activation

Keep all flags off until these are completed:

1. Apply the reviewed migrations and provision a private media bucket, authenticated TLS decoder service and separately trusted billing evidence source. Pin and scan the decoder container image/package versions for deployment. Deploy the decoder with a read-only filesystem, writable temporary directory, memory/CPU limits, no outbound network and TLS at the private ingress.
2. Register Meta and LinkedIn applications with the exact `/api/social/{platform}/callback/` production/staging URLs. Obtain the applicable platform approvals. LinkedIn `r_member_social` is restricted; without it the publisher deliberately refuses execution. Facebook personal profiles and consumer Instagram accounts are unsupported.
3. Supply server secrets `SHOTSTACK_API_KEY`, `AGENTGRID_PROBE_KEY`, `AGENTGRID_META_CLIENT_SECRET`, `AGENTGRID_LINKEDIN_CLIENT_SECRET`, and independent 32-byte hex keys `AGENTGRID_SOCIAL_TOKEN_KEY` and `AGENTGRID_MEDIA_GRANT_KEY`. Set public client IDs, `AGENTGRID_META_API_VERSION` to a reviewed supported version, the private `AGENTGRID_VIDEO_PROBE_ORIGIN`, and server-only JSON `AGENTGRID_RENDER_OUTPUT_HOSTS` / `AGENTGRID_RENDER_RATE_CEILING`. No production Meta version is guessed or defaulted. `v23.0` appears only in synthetic tests.
4. Bind the trusted billing reconciler as `AGENTGRID_RENDER_BILLING`, with a `verifiedCost(taskId)` RPC, before finalizing rendered assets. The Worker passes it through `verifiedBilledCost`. The queue's default billing port returns no evidence and holds the reservation. Rate ceiling fields are `revision`, `imageMicros`, `speechCharacterMicros` and `renderSecondMicros`, all positive integer USD millionths.
5. Deploy the reviewed workspace controls with all flags off. The workspace now provides provider-verified account labels, explicit destination enablement, cost/video/caption/schedule approvals, history, cancellation, revocation and explicit continuation/readback actions. The disabled private scheduler recovers due approved jobs. Complete real-provider eligibility and reauthentication acceptance during a separately authorized pilot. Automatic retries of publish actions remain prohibited. See activation/README.md for the disabled setup.
6. Perform a separately authorized pilot using real app credentials, a nonzero spending allowance and owner-approved test destinations. This change's tests use simulated providers only; provider app approval and real delivery are not claimed.

## Primary API references checked 10 October 2026

- [Shotstack v1 reference](https://shotstack.io/docs/api/)
- [Meta Facebook Reels collection](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api)
- [Meta Instagram API collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api)
- [LinkedIn authorization code flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)
- [LinkedIn OpenID Connect](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2)
- [LinkedIn Videos API, September 2026](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-09)
- [LinkedIn Posts API, September 2026](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-09)

Mock acceptance tests cover disabled paths, composition, billing/ownership gates, private bytes, redirected credential prevention, upload sequences, readback, replay, token sealing and expiring media grants. Database acceptance covers the new tables, default-off policy, owner/session isolation, receipt transitions and duplicate refusal. No real-user opinion or platform endorsement is recorded by these fixtures.
