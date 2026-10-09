# Production release

Production uses the separate `agentgrid-production` Cloudflare Pages project in the personal account. The canonical origin is `https://agentgrid.me`. Staging remains a separate noindex pilot.

## Prerequisites

- At least 36 released, individually reviewed resources and at least three useful resources in each launch category. Related resources must exist in the released catalogue. The deployment script enforces the existing inventory gate.
- The committed public catalogue and delivery manifest must match a fresh anonymous database capture. `content/launch/reviewed-editorial.json` contains the exact immutable full guides keyed by version, including private search intent and author declarations; it is checked against each public projection and never copied into the site.
- An exact reviewed main commit, a clean checkout and all required checks. The manual workflow requires its input commit to equal the workflow commit. It uses the existing private repository's Pages deployment credential.
- Production-only encrypted `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `AGENTGRID_ENVELOPE_KEYS` and `AGENTGRID_RATE_KEY`. Preview has no application bindings. Production must not inherit pilot admission, staging encryption material or staging email credentials.
- The human creates the sending-only Resend key restricted to `mail.agentgrid.me` and saves it as encrypted `RESEND_API_KEY` directly in the production project. The bootstrap preserves that opaque value and refuses to mutate anything if it is absent.
- Shared Supabase Auth production callback eligibility and Google OAuth production readiness verified without replacing PicMagic's Site URL, callbacks or keys.
- Real account, email and community acceptance checks complete. An account controlled by the publisher is an operator test, not an independent community endorsement. Publisher/reporter conflicts must remain enforced.

## Setup and deployment

`configure-production.mjs` is dry by default. `--create` creates only the empty container; it changes no DNS, credentials or billing. An uncertain mutation is never blindly retried: a later run first reads provider state.

`configure-production-secrets.mjs` is also dry by default. Its explicit apply mode creates only the named `agentgrid_production_backend` managed backend key, preserves other shared-project keys, and fills missing production bindings with independently generated envelope and rate material. Existing encrypted values are never returned or replaced. The backend key has project-wide service-role authority; application operations remain confined to AgentGrid resources. Keep management credentials in memory and out of logs and repository files.

Use **Deploy production application** with the exact main commit. It runs dependency auditing, application, backend and disposable database checks before deployment. It checks the inventory and fresh capture, validates the provider bindings, rebuilds production indexing with only public configuration, verifies static/private-artifact boundaries and recaptures after compilation. The tested Worker is uploaded without rebundling from an isolated directory. Publication and analytics remain disabled on production; community admission remains controlled by the database configuration.

Associate `agentgrid.me` with the Pages project before replacing parked apex DNS. Activate routing only for the accepted release. Preserve email records and unrelated domains. Creation of the Pages container alone does not mean the site is live.

The release is successful only when provider readback confirms the exact canonical deployment and both the provider alias and canonical HTTPS origin serve the exact build proof. Canonical identity must return private, uncached anonymous state with a secure host-only CSRF cookie; the provider alias must not mint a session. Private and unknown paths must return 404. Every released resource must be served by the current delivery guard.

If upload completes but domain verification fails, inspect provider state before another upload. After routing is activated, run `node scripts/verify-production.mjs EXACT_COMMIT` from the reviewed capture checkout with only public Supabase configuration. This performs read-only inventory, capture, build-identity, route, indexing and identity checks. It does not deploy, change DNS or roll back. An upload receipt alone is not a successful launch.
