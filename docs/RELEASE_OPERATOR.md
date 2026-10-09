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
