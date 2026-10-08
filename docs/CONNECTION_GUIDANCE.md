# Platform and connection guidance

`content/connections/guides.json` is an editorial source document, validated at
build time by `src/domain/connection-guide.ts`. Platform and integration pages
explain setup decisions and connect readers to resources with exact declarations.
The MCP page explains the protocol; it is not a server listing or installation.

Every guide has an official source, documentation check date and next review date.
Provider facts and AgentGrid recommendations are distinguished in the page. New
source hosts require an explicit code review. Content is plain text rendered by
React; sources require HTTPS, an allowlisted host and no embedded credentials.
Build validation rejects malformed routes, duplicate identities, invalid dates,
unknown categories, credential signatures and oversized documents.

A platform relationship requires an exact platform slug. An integration
relationship requires an exact tool ID and integration kind. Mentioning a provider
in prose is insufficient. The protocol guide has no server identity and cannot
create a matching-agent relationship. Related-resource lists show at most eight
entries with the total count and a route to the full catalogue. Local preview can
show labeled drafts; production uses the publication loader exclusively.

Integration guides join the existing SearchProvider abstraction with qualified
identities and an editorial state. They do not get verification badges, invented
ratings, usage counts, installation actions or capability edges. Agent platform
facts link back to the corresponding guide when one exists.

## Review and publishing

The six initial guides cover ChatGPT, Claude, Gemini, Google Search Console,
GitHub and MCP concepts. Official documentation was checked on 2026-10-08. The
Gemini guide explicitly dates Google's announced November transition and is due
for review on 2026-11-01; other guides are due on 2026-11-08. Before release, an
editor must recheck sources and host setup details. Do not update dates without
actually reviewing the source. Stale guides display a notice at build time;
static delivery cannot change that notice without a new deployment. Include due
reviews in the publishing checklist and rebuild when provider guidance changes.

Guides remain noindex and outside the sitemap until the site's editorial indexing
gate is approved. Breadcrumb markup identifies navigation only. It does not claim
SoftwareApplication, review scores, certification or provider affiliation. Actual
agent compatibility still requires version-specific host evidence and publication
approval, independently of these guides.
