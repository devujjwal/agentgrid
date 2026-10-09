# Staging credential custody

Owner authorization received 2026-10-09 explicitly permits the revocable
`agentgrid_staging_backend` Supabase key, the existing restricted Resend sending
key and AgentGrid session keys in encrypted Cloudflare staging server bindings.
The owner understands that the Supabase key is project-wide despite its name.

The bootstrap in `scripts/configure-staging-secrets.mjs` accepts explicit inputs
in memory. It has no filesystem, console or environment discovery. Default mode
is read-only. Apply creates at most the one named key and adds only missing
bindings to the main deployment environment of `agentgrid-staging`. Branch
previews have no secrets. Existing opaque secrets are never overwritten. Retry
begins with provider reads; incomplete setup reuses the exact named key. Ambiguous
responses stop without printing provider bodies. Rotation is a separate operation.

Applied and read back on 2026-10-09:

- Supabase key ID `05f31aea-00c5-4259-9be1-83fafcfa7c3a` (an identifier, not a secret).
- Five `secret_text` bindings: `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`,
  `AGENTGRID_ENVELOPE_KEYS`, `AGENTGRID_RATE_KEY`, `AGENTGRID_PILOT_EMAILS`.
- Public Supabase origin/key and the existing `mail.agentgrid.me` sender address
  stored as plaintext configuration. Only the personal owner is in the pilot.
- Existing Supabase keys preserved. No deployment, paid binding or billing change.
- Superseded privileged fields removed from `.env.agentgrid.local` after encrypted
  binding confirmation. No new secret was written to a local file or GitHub.

Ordinary community operations use verified member credentials and AgentGrid RLS.
The privileged binding is limited by application code to necessary identity and
AgentGrid server operations; its provider scope does **not** enforce that limit.
Never use it to modify PicMagic data, for local publication or in GitHub builds.
Compromise requires revoking this exact key and replacing server bindings, plus
assessing exposure across the shared project. When extracting AgentGrid, recreate
the backend in its own project and replace the origin/public key and encrypted
bindings; revoke this key after successful validation. Removing old AgentGrid
resources still requires explicit owner approval.

Session keys are independent random 32-byte values. Deliberate envelope rotation
uses the existing two-key maximum so old sessions can expire; rate-key replacement
requires its own abuse-control review. Do not use this bootstrap to rotate them.

The callback operator adds exactly
`https://agentgrid-staging.pages.dev/auth/callback/`. Its audit evidence contains
digests and callback metadata only. The protected baseline reconstructs the prior
approved Google setup and rejects changes to any other auth field, including
PicMagic Site URL, SMTP, templates or broader redirect patterns. Both protected
schema verification and anonymous/authenticated access-denial probes passed after
application. Successful binding/configuration readback does not yet prove Google
code exchange, Resend delivery or a live member session; those remain staging QA.

Live Google initiation exposed a missing JWT role in the newly created key. The
exact named key was corrected to `secret_jwt_template: { role: "service_role" }`,
within the explicitly approved project-wide backend scope. Key material, ID and
all other project keys were unchanged. Bootstrap creation and existing-key checks
now require this exact claim. Initiation still failed after that correction;
safe operation-name/HTTP-status diagnostics were added for the next deployment.
No provider messages, headers, parameters, identities or secret values enter them.

The first staging upload `9650acf6-b0cd-4d4a-9aea-43623450e31f` at main `0592d193`
succeeded at Cloudflare, but workflow `37889851369` did not confirm its receipt.
Independent later delivery checks passed every assertion (headers, exact build
identity, anonymous CSRF response, private/unknown route denial and robots).
The original failure stage was not recorded; propagation is a possibility, not a
proven diagnosis. The deployer now records a fixed phase label on failure and
retries only delivery reads in a bounded window, never repeating an upload.

Provider references verified on 2026-10-09:
[Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys),
[key creation](https://supabase.com/docs/reference/api/v1-create-project-api-key),
[key inventory](https://supabase.com/docs/reference/api/v1-get-project-api-keys),
[Cloudflare Pages configuration](https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/edit/).
