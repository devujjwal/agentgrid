# Private render billing reconciliation

This service is prepared with execution and reconciliation disabled. Its only settlement entry point is the `verifiedCost(taskId)` service-binding RPC. It has no public route or preview URL; HTTP returns 404. It cannot create renders or posts. The execution Worker has no binding to its separate private evidence bucket.

Shotstack's [production status response](https://shotstack.io/docs/guide/generating-assets/ai-generation-pricing/) supplies total actual render/generation credits. Credits alone do not establish the exact USD debit under the owner's plan, free credits, refunds or invoice allocation. This first implementation therefore requires an operator-reviewed, task-specific provider debit receipt, retained alongside the original evidence. It is a manual reconciliation workflow, not an automatic invoice feed.

## Evidence and trust boundary

An authorized billing operator reviews actual provider usage and invoice/debit evidence for a known private-ledger task. They must establish the exact USD amount allocated to that task, including any refund or free-credit treatment. If only a quote, aggregate invoice or credit balance is available, do not create a receipt. Leave the reservation held. Non-USD evidence needs a separately reviewed conversion procedure; this version refuses it.

Store the original evidence bytes privately at `evidence/<sha256>` in `agentgrid-billing-evidence`. Store the reviewed manifest at `receipts/<task-uuid>.json`; its fields are defined by `BillingReceiptSchema` in `reconcile.ts`. `reviewedBy` is the responsible operator's profile UUID, `reviewedAt` the actual review timestamp, `providerOwner` the Shotstack account owner ID, `credits` the actual task usage and `actualDebitMicros` the exact USD debit in millionths. `basis` must be `task-specific-provider-debit`, `settled` true and `currency` USD. Zero is permitted only when actual task-specific evidence establishes a zero debit. Hashes establish evidence integrity, not invoice authenticity; the operator and restricted bucket-writing credentials are the authority for the attestation.

Do not grant bucket writes to members, Pages or the execution Worker. Keep provider billing documents and manifests out of Git, chat, analytics and logs. Retain each original evidence object and previous manifest version in the operator's audit archive before correcting a receipt. Never overwrite a receipt to invent a cost or force settlement.

The RPC reads bounded private objects, verifies evidence integrity and independently reads `GET https://api.shotstack.io/edit/v1/render/<task-uuid>` using the same production account. ID, owner, completed status and actual credits must match. Redirects, absent fields, missing/corrupt evidence, future review dates or provider errors return no verified cost. The existing render ledger also checks task ownership, maximum approved cost and atomic settlement, preventing duplicate debits. Missing evidence never becomes zero.

## Disabled provisioning

The current owner budget is zero. Steps involving R2 billing or billable hosting are deferred and must not be executed under the present authorization. Local packaging, synthetic tests and permission preparation can continue without provisioning. This reconciler is retained for a later authorized cloud-rendering plan; no provider debit receipts exist because no renders have been initiated.

1. Enroll Cloudflare R2 billing and provision the private bucket without public access. Financial enrollment requires the owner to complete the checkout. Review IAM for the operator's upload path; no upload credentials are created by this code.
2. Build with `node scripts/build-disabled-workers.mjs`. This packages both Workers without uploading, creating infrastructure or invoking providers. CI performs this check.
3. Deploy this Worker with its evidence bucket. Supply the same-account Shotstack credential directly in its secret manager, and configure `AGENTGRID_SHOTSTACK_OWNER` from verified account metadata. Never copy an encrypted Pages secret into logs. Both flags stay `0`.
4. Provision `agentgrid-private-media`, bind it to Pages and the execution Worker, and deploy the execution Worker with its private billing service binding and existing queues. Supply required secrets through the established owner handoff. All five execution flags stay `0`; allowances remain zero.
5. Before a separately authorized pilot, exercise the service-binding RPC with no receipt and verify null and zero external requests while disabled. Real provider evidence, USD allocation, private hosting and provider permissions remain activation prerequisites. Mock fixtures are not financial evidence.
