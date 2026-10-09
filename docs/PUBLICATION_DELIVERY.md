# Public catalogue capture and delivery

Release approval, database release, static capture and deployment are separate
states. An approved version does not appear on the public site merely because the
review request succeeded. Live saves, reviews and workspace operations remain
independent of the static catalogue.

## Capture and build provenance

`pnpm publication:capture` reads only anonymous AgentGrid public RPCs using
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. It rejects
privileged keys, unexpected origins/routes, redirects and oversized responses.
It does not read local setup secrets, mutate the database or deploy anything.

Migration 023 adds an owned publication revision. Release changes, released
resource visibility and relevant creator/attribution changes advance it; private
draft edits and community counters do not. Capture walks ordered 250-row pages,
fetches at most four resources concurrently, then repeats the complete index.
A changed revision, public delivery tag, missing resource or identity mismatch
rejects the entire candidate. The closed projection excludes private evidence,
editorial approval and account data. Bounds: 10,000 resources and 32 MB catalogue;
review capacity and performance before increasing either.

Candidates are written exclusively into ignored, confined local directories under
`.agentgrid-publication-candidates`. Existing candidates cannot be overwritten.
A pair consists of `catalogue.json` and `delivery.json`. The latter identifies the
source revision, capture time, resource/version/path/tag inventory and SHA-256 of
the schema-ordered compact public catalogue. Whitespace does not change its hash.
The committed empty pair is a bootstrap inventory, not evidence of a remote capture.

Both production frontend and Worker builds verify the pair before compilation.
Missing, malformed, mismatched or substituted content fails the build. Review both
files together in the private repository; never copy raw tables or working drafts
into publication inputs. Build provenance is separate from evidence/version and
artifact-byte digests. None is an interchangeable trust assertion.

## Live detail boundary

The Pages function on `/agents/*` compares each deployed detail's public delivery
tag with the current anonymous database projection before serving it. This covers
HTML, direct file/clean-URL aliases and Next navigation payloads. It uses no
privileged key. Unknown paths return 404, withdrawn deployed resources 410, and
changed/unverifiable releases 503 with Retry-After. Failures have accessible,
server-rendered branded HTML without scripts or user-supplied interpolation.

Detail responses are private/no-store at browser and CDN boundaries. Conditional
and range requests cannot revive earlier bodies. Listing documents remain static
and provider-independent. The production project must use **fail closed** for
Functions quota exhaustion and must not override these responses with a cache rule.
Validate the actual provider routing, direct deployment aliases and cache policy
before launch; local unit/workerd checks alone do not prove those settings.

Withdrawal stops subsequent guarded detail requests. It cannot recall information
already downloaded, browser navigation memory or third-party copies. Summaries in
discovery pages/search indexes remain until an urgent fresh capture/rebuild; they
must be purged as part of takedown operations. Do not claim that changing a database
flag clears every static surface. Newly released versions can temporarily return
503 until the matching build is deployed; retain the old deployment for recovery,
but do not bypass current public tags to make an obsolete rollback serve content.

## Remaining launch gates

Candidate promotion, deployment batch receipts, exact-build provider verification,
urgent rebuild recovery and production quota/cache configuration remain required.
No production publishing workflow or privileged release credential is activated by
this increment. The catalogue is empty; synthetic acceptance fixtures never become
real inventory, observations, reviews or creators.

## Promotion and staging release

`pnpm publication:promote <candidate-name> <complete-catalogue-sha256>` requires a
clean local repository, the personal Git identity, a confined candidate and the
complete reviewed digest. It re-captures the current anonymous source and refuses
changed revision/content/tags. It promotes only the two tracked publication inputs;
it never commits, creates a release or deploys. The original candidate remains.
If interrupted between file replacements, the build fails closed: deliberately
restore the exact pair from the retained candidate, inspect the diff and rerun the
gates. Never repair a mismatch by changing only its hash.

The `Deploy staging application` workflow is manual, main-only and requires the
exact clean commit. It runs the complete quality suite, then supplies the existing
Cloudflare deployment credential only to the deployment step. Supabase public
configuration is held in repository variables; privileged application credentials
are encrypted Cloudflare server bindings and are never GitHub build inputs.

The deployer checks source freshness and the isolated staging project, assembles
the tested static export and compiled advanced Worker outside the checkout, and
scans the assembled output. Wrangler cannot discover the repository's local setup
files or rebuild a different functions directory. Only `agentgrid-staging` in the
approved personal account is accepted. The production domain cannot be targeted.
The Pages production branch is `main`, but its application stage is **preview**,
with an owner-only authentication pilot and noindex crawler policy.

A successful receipt binds the Git commit, catalogue checksum/revision, Cloudflare
deployment ID, staging origin and verification timestamp. The workflow retains it
privately for 30 days; export it to the release archive before expiry. Verification
checks current provider deployment identity, public HTML/security headers, anonymous
identity cookies, crawler exclusion and denial of unknown/QA/worker/setup paths.
This is deployment-boundary acceptance, not a substitute for real Google/email and
full authenticated user journeys.

A failed or interrupted deploy may have completed remotely. Inspect the current
provider deployment and its `/agentgrid-release.json` identity before retrying.
Never infer failure from a lost CLI acknowledgement, and do not automatically
roll back to a catalogue whose live resource tags no longer match. Real provider
routing and credential-binding acceptance remain pending until staging deployment.

The staging smoke test also looks up the reserved `admin` creator handle through
the anonymous live projection. The schema forbids that handle, so the expected
result is a private/no-store JSON 404 with no cookie. This valid request must reach
PostgreSQL; a syntactically invalid handle would only test request validation.
Provider outages, transport failures and accidental exposure fail deployment
acceptance. The probe creates no data and uses no privileged credential.
