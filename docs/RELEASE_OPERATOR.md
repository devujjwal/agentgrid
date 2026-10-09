# Reviewed release operator

The local operator in `scripts/release-reviewed.mjs` completes the reviewed
publication boundary. It is not part of the browser, Worker or GitHub workflow.
`prepare` is read-only; no command infers a publish action.

```
node scripts/release-reviewed.mjs inspect <request-uuid>
node scripts/release-reviewed.mjs prepare <request-uuid>
node scripts/release-reviewed.mjs publish <request-uuid> <review-sha256> <main-commit>
```

Publishing requires a clean exact main checkout, unchanged global Git identity,
verified personal remote ownership/authentication, successful CI for that exact
remote main, and the preparation fingerprint. Preparation rechecks the persisted
staff request, immutable version and selected host observations against the full
quality gate. A changed review requires fresh preparation. Workflow artifacts
remain blocked until guarded public artifact delivery is implemented.

The narrow SDK transport allows only the three reviewed-release RPCs, refuses
redirects, bounds response size/time and suppresses provider diagnostics. It never
loads setup files or discovers credentials. A missing acknowledgement is not a
failed transaction: inspect the existing request before considering another write.
A released receipt is historical; later moderation can hide a resource. Capture,
promotion and deployment are distinct steps after database release.

Credential provisioning for this local operator has **not** been activated. The
approved staging Supabase secret belongs exclusively in Cloudflare's encrypted
server bindings and must not be reused here, exported locally or placed in CI.
A future production publisher must use an explicitly authorized credential and
execution environment, or move this operation behind a separately reviewed
server-side boundary. Do not weaken this requirement to release content.

Verification uses synthetic fixtures only, including fingerprint drift, lost
acknowledgements, readback, endpoint denial, oversized responses and output
redaction. No fixture is host-test evidence for a real package.

## Cloudflare server publication

The reviewed server path is `/api/admin/publication/`. `AGENTGRID_PUBLICATION_ENABLED`
defaults off. It supports explicit `inspect`, `prepare` and `publish` actions,
with a request UUID and the preparation fingerprint for a write. It accepts no
actor, manifest, specification or test output from browser JSON. The authenticated
managed subject comes from the existing encrypted application session. A fresh
user-RLS workspace lookup must show active AgentGrid administrator authority.

Migration 030 adds one service-only `agentgrid_server_publication` RPC. It checks
the supplied server-verified subject against AgentGrid identities, active profiles
and administrator roles under the same transaction lock used by governance and
publication. Browser roles, ordinary members, moderators, suspended users and
revoked administrators cannot execute it. Shared Auth metadata is not authority.
The narrow server adapter can reach only this RPC; the shared project secret stays
inside its approved encrypted Cloudflare binding.

The existing quality preparation, immutable evidence selection, fingerprint check,
atomic release transaction and separate outcome readback remain in use. No shortcut
accepts a browser-authored quality manifest. The UI requires preparation and a
confirmation, removes the prepared action before writing, and blocks retry after
an uncertain result until inspection succeeds. Historical release is distinguished
from current visibility and static deployment. Workflow-artifact publication stays
closed until artifact delivery is implemented and verified.

Activate only after migration rollout and an exact-main verified deployment.
The real administrator session and real quality-reviewed inventory still require
live acceptance. Local synthetic tests do not establish those results. Public-only
capture and promotion use the existing publishable-key transport; they require no
privileged local credential. The legacy local operator remains unprovisioned.

## Temporary first-party authoring capacity

Migration 031 adds `agentgrid_configuration.editorial_authoring_until`, initially
null. Only the configured active first-party publisher with an existing
administrator role can receive the temporary allowance, while submissions are
enabled and the deadline has not passed. It permits at most forty resource
creations and forty immutable submissions in each existing 24-hour window.
Ordinary members retain ten; forks retain ten for everyone. Counters and window
timestamps are retained when the allowance starts, expires or is revoked.

An operator must retain the exact deadline and before/after configuration and
quota readback. Use a deadline within seven days for initial catalogue preparation;
clear it after that work. Browser roles and the application service role cannot
change the configuration or call the internal quota helper. This setting grants
no new account or staff access, creates no release, and changes no licensing,
ownership, revision, immutable-version, evidence or publication checks.

The shared migration operator uses the existing common Git directory for both
its owned-schema record and uncertain-write intent. It accepts a clean detached
checkout of the exact remote main commit so the primary workspace can remain
untouched. Personal identity, remote ownership, exact committed SQL allowlist,
completed main CI, applied checksums and protected-schema checks remain required.
