# Guided recipe publication

Recipes are first-party editorial sequences, not executable agent packages or
background automation. Each step pins an exact agent version and canonical
specification SHA-256. The UI identifies what to supply, what to check and what to
carry forward. Illustrations are labelled expected behavior, never observed tests.

Private authoring lives in `content/recipes/drafts.json`. Only the loopback design
build reads it. CI and public builds cannot enable that path. Public recipes live
in the separately reviewed `content/publication/recipes.json` envelope. This is a
trusted repository publication boundary: community submissions cannot write it.
Do not add an entry just because schema validation passes.

Before a publication PR, a reviewer must check standalone usefulness, source and
permission boundaries, reuse rights of each dependency, complete normal/missing/
adversarial workflow runs, and evidence of each human handoff. Retain redacted
observed outputs and the actual host/version/date in the private review record.
The currently committed public manifest is empty; all six workflows await this
acceptance. A date or passing unit test is not host-run evidence.

The loader includes a recipe only while every pinned specification is in the
validated public agent snapshot. Changing instructions, version, license or any
other pinned specification field makes the dependency ineligible. Update pins
only after reviewing and testing the new sequence. The export gate rejects stale
HTML and RSC detail artifacts, including those left by an older export. Public
recipe URLs alone enter the sitemap and receive Article/Breadcrumb structured
data. Drafts remain noindex and are absent from all public discovery output.

Recipe pages use batch publishing, like editorial content. A live agent withdrawal
blocks the linked agent detail immediately through its existing delivery guard;
the recipe text and discovery listing change on the next approved publication.
For a recipe-specific takedown, remove the public manifest entry and deploy a
clean reviewed build. Do not represent this batch lifecycle as immediate recipe
revocation. An urgent safety takedown requires expedited deployment and verification
of both the removed detail path and discovery cache. Before production, test this
provider-side removal and cache behavior.

No new database resource, integration permission, paid runtime or service was
introduced. Community data remains served by the existing live backend.
