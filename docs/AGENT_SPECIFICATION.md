# Universal Agent Specification 0.1

The specification describes a usable resource and its boundaries. It does not
promise that every host can run every package, and AgentGrid does not execute
agents on behalf of visitors. Platform adapters consume a single validated
definition; support is explicit per platform and distribution mode.

## Portable contract

`src/domain/agent-specification.ts` defines the strict versioned Zod contract:

- Identity, purpose, category, package semantic version and distinct capabilities.
- Interactive, scheduled or event execution; instructions; a real artifact path
  and immutable file checksum for importable/automated workflows. An interactive instruction package cannot
  silently claim that it is scheduled automation.
- Named input/output contracts and sensitive-input disclosure.
- Requirements, platform setup guides, integration/MCP tools and read/write/network
  permissions. Writes require explicit confirmation; tools reference real requirements.
- Limitations, privacy, approval and untrusted-input policies, with task-specific
  examples and independently testable assertions.
- Explicit free AgentGrid access and separate host/runtime cost disclosures.
- Explicit package license and reuse permissions. Drafts may remain unselected;
  public publication must reject that state. No community open-license default.
- Bounded namespaced JSON extensions for future adapters, with an explicit schema
  version for incompatible changes. Unknown top-level fields are rejected.

Profile ownership, creator attribution, role claims, popularity, moderation state,
publication times and reviews are authoritative application data outside this
portable payload. A submitted specification cannot appoint its creator or claim
administrator status. Application components access environment-parameterized
services, never hardcoded PicMagic project identifiers.

## Validation layers

The portable parser establishes structure, size bounds, reference integrity,
permission consistency and distribution boundaries. It is not an editorial
quality claim or a complete security scanner. Backend endpoints validate every
untrusted request; database permissions independently protect ownership and
state transitions. Moderation and publishing parse again before public export.

Editorial records will attach search intent, factual overview, FAQ, sources,
related resources and actual verification evidence. Immutable submitted versions
include the exact content reviewed. Publishing selects approved versions into a
public allowlist; drafts, private profiles and unapproved records never become
static build inputs. Live saves/reviews/profile activity remain separately queried.

Test evidence distinguishes deterministic contract checks, real host behavior and
editorial review. A model-generated illustrative output is labelled as expected
behavior, never represented as a real test run. Broad launch inventory remains
quality-gated, with meaningful marketing/productivity/research/education/content/
ecommerce/business/everyday coverage alongside SEO and development.

## Licensing boundary

Standard identifiers must agree with their standard reuse grants. Custom licenses
must explicitly permit modification/redistribution before public forks are allowed.
Attribution and lineage remain attached to the immutable source version. The
private application license is independent of package licensing. First-party
release licensing will be reviewed with concrete reusable package terms before
publication; drafting a package does not release it under an open license.

## Publication acceptance

`backend/publication/quality.ts` prepares private, checksum-bound evidence from
the immutable specification **and editorial record fetched together**. Search
intent, useful context, audience/workflow guidance, factual sources, FAQ, related
resources and explicit editorial/security/reuse review must be present. Every
declared host needs actual recorded normal, ambiguous-input and adversarial-input
checks; records must match the canonical specification and be no more than 90 days
old. Failed, illustrative, missing, stale or future records cannot pass. Potential
credential signatures block retention/publication with redacted errors.

These checks establish evidence integrity and completeness, not whether a human
has truthfully recorded a real test. A trusted reviewer must examine observed
outputs and actual assertions. Synthetic unit/SQL fixtures exercise the gates;
they are never seeded as real runs, reviews, release records or editorial work.
Backend approval verifies the moderator's real identity, reloads the immutable
bundle and prepares evidence server-side. Browser flags cannot approve a version.
Provisioning its narrow server-only publication RPC credential is a later,
separate account authorization; no privileged key is deployed by the migrations.

`canonical-json-v1` sorts object keys by UTF-16 order and serializes finite JSON
values without whitespace. Unsafe integers must be strings, preserving portable
precision. This canonical SHA-256 identifies test/package content independently
of the database JSONB bundle digest and the downloadable artifact's exact bytes.
All three purposes are explicit; they are not interchangeable.

An imported/automated resource also requires an owned artifact resolver and its
matching raw-byte checksum. Initial release preparation accepts bounded, valid
UTF-8 JSON only and scans it for credentials; ZIP support remains unavailable
until a safe adapter and real host tests exist. The resolver uses owned private
assets, never fetches an arbitrary user-submitted URL. Actual delivery/storage and
platform adapters still require integration acceptance before being offered.

The launch gate requires at least 36 prepared resources and meaningful coverage
across all ten categories, rejects exact instruction/intent/slug duplication and
broken related links, and imposes no upper inventory ceiling. Semantic overlap and
standalone value still require editorial judgment; a large count never overrides
the quality bar. Full inventory creation and real-host verification remain Phase 6.
