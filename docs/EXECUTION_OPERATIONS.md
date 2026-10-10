# Hosted text execution operations

Status: implementation tested locally; production activation is pending. Never
interpret a successful build or synthetic QA result as a real provider acceptance.

## Provision and deploy with execution disabled

1. Run the shared-backend inventory/verification described in `SHARED_BACKEND.md`.
   Apply migration 032 through AgentGrid's independent migration/checksum history,
   then verify the protected metadata and effective access again. Never reset the
   shared Supabase project or modify global grants/auth configuration.
2. Provision dedicated Cloudflare queues `agentgrid-execution` and
   `agentgrid-execution-dead`. Bind the first as Pages production producer
   `AGENTGRID_EXECUTION_QUEUE`. Deploy the consumer with
   `backend/execution/wrangler.jsonc`; its flag starts at `0`.
3. Set the consumer's production configuration to the existing AgentGrid Supabase
   origin and publishable key. Add its server-only `SUPABASE_SECRET_KEY` using the
   protected secret mechanism. Add an OpenAI project-scoped `OPENAI_API_KEY` only
   to this consumer; never place it in Pages public variables or browser code.
   The credential grants access to a shared backend, so use only its fixed AgentGrid
   RPC endpoint. This implementation does not confer new staff access.
4. Deploy the Pages API/static workspace with `AGENTGRID_EXECUTION_ENABLED=0`.
   Compile the consumer with `wrangler deploy --dry-run --config
backend/execution/wrangler.jsonc` before a real deployment. The disabled workspace
   works without migration 032 and requires an existing active community profile.

## Activate a bounded owner pilot

Recheck pinned model availability and standard input/output prices in `openai.ts`
before activation. Update provider identity and tests whenever pricing changes;
prepared runs cannot silently switch provider/model/price revision. Estimates use
UTF-8 text bytes plus framing allowance and 2,048 maximum output tokens; discounted
cached usage is conservatively counted at standard input price. Allowance figures
are internal cost estimates in USD millionths, not purchased credits or invoices.
Provider-account budget alerts are useful additional controls, not the atomic guard.

Record the approved total/member limits and eligible pinned version IDs in the
private launch evidence. The database owner alone funds `agentgrid_execution_policy`
and `agentgrid_execution_budgets` and enables reviewed rows in
`agentgrid_execution_packages`. No browser operation can top up an allowance.
Review each package's use license, tool-free assistive instructions and privacy
compatibility. Keep other members' allowances at zero during the owner pilot.

Update the privacy disclosure before sending real member content to OpenAI, including
provider processing, its applicable retention practices, support contact and run
retention/deletion rules. `store:false` disables Responses application storage; it
is not a claim that the provider retains no data under all account policies.

Enable the database policy and consumer, then the Pages flag. Confirm one owner
run through the actual workspace with a synthetic brief and the approved cost cap.
Check provider usage, private output persistence after refresh, one settlement
record, remaining allowance and duplicate confirmation delivery. Verify a second
ordinary member cannot see it. Broader activation follows real acceptance.

## Limits and recovery

- At most 20 preparations per member in a rolling day, five charged dispatch attempts
  per UTC day, and one unresolved reservation per member. Each run reserves its
  full quote against both member and site limits atomically before dispatch.
- Confirmation expires after 15 minutes. Queue duplicates use the same ledger claim
  and cannot trigger a second provider call. A deployment that disables the consumer
  acknowledges jobs without dispatch; prepared records remain recoverable and may
  be explicitly confirmed again after activation.
- Cancellation before claim prevents any provider call. Cancellation after claim
  discards output, but cannot undo a provider charge. Actual bounded usage settles
  once and releases unused reservation. A worker lost for two minutes becomes
  `uncertain` on subsequent owner read; it retains the reservation and never retries.
- Do not refund or redispatch uncertain runs based only on a timeout. A trusted
  operator must compare provider usage and recorded request evidence. Resolve the
  reservation through the server-only finish operation with verified bounded usage
  (zero only with evidence of no charge). Do not expose settlement to member APIs.
  A revoked/suspended member also requires operator investigation; its hold cannot
  be released through a suspended user's session.
- Spending events contain run ID, state/cost and timestamps, never prompts or tokens.
  Completed/cancelled/blocked content older than 30 days is erased on that owner's
  next overview read. This is lazy cleanup, not a guaranteed deletion schedule.
  Uncertain held runs retain evidence for reconciliation. A dedicated cleanup job,
  support deletion procedure and published retention policy must be completed before
  broad activation; no shared-database scheduler is created by this change.
- Disable the database policy to stop new claims, then the Pages flag. Do not delete
  ledger rows or reset held/spent totals during an incident. Inspect dead-letter
  messages and existing state before confirming any recovered job.

## Reel and publishing follow-on

The next implementation adds a private AgentGrid media bucket, video-provider task
IDs, durable polling, verified media formats and a preview. Social publishing then
adds encrypted OAuth connections, per-platform delivery records and approvals
pinned to the exact media checksum, caption, destination and schedule. No social
access tokens, video calls or posting integrations are activated by this text pilot.

Reel/social migration 033 and offline implementation are described in
[reel and social operations](REELS_SOCIAL_OPERATIONS.md). The owner has explicitly
chosen to keep all execution disabled and allowances at zero. Preserve that state.
