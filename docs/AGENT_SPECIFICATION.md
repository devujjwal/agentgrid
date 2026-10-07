# Universal Agent Specification 0.1

The specification describes a usable resource and its boundaries. It does not
promise that every host can run every package, and AgentGrid does not execute
agents on behalf of visitors. Platform adapters consume a single validated
definition; support is explicit per platform and distribution mode.

## Portable contract

`src/domain/agent-specification.ts` defines the strict versioned Zod contract:

- Identity, purpose, category, package semantic version and distinct capabilities.
- Interactive, scheduled or event execution; instructions; a real artifact path
  for importable/automated workflows. An interactive instruction package cannot
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
