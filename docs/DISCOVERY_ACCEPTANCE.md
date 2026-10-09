# Discovery and distribution acceptance

## Generated crawl output gate — 9 October 2026

`pnpm build` now checks the exported documents as well as source contracts.
`pnpm verify:crawl` reruns the read-only check against an existing `out/` build.
It validates clean production canonicals, distinct public titles/descriptions,
one meaningful H1 and main landmark, document language, unique element IDs,
parseable schema.org JSON-LD, internal destinations and decoded fragment targets.
Private/status documents must retain noindex. Sitemap entries must exactly match
the separately validated public agent/recipe inventory, resolve to generated pages
and not contradict those pages' noindex metadata. Query/fragment sitemap variants,
external origins, duplicates and malformed sitemap structure are refused.

The audit makes no network requests, reads no credentials and changes no indexing
setting. Dynamic creator links are recognized by their exact route family but
require the separate live creator tests. This gate does not establish semantic
schema validity, editorial quality, external-link freshness, JavaScript-generated
links, HTTP status/redirect correctness or production robots/header behavior.
Prelaunch crawler exclusion stays in place. Future approved editorial sitemap
entries must be deliberately added to both the sitemap and its inventory contract;
do not weaken the check to accept arbitrary generated pages.

## Scope and publication boundary

The ten first-party drafts remain unlicensed, unverified and unpublished. They
appear only in the loopback design build. `content/publication/catalogue.json`
contains zero releases. No fake community, host result or popularity data is
written to Supabase or supplied to a deployed application.

Production builds read a bounded, strict public catalogue. The release projector
accepts only the exact public-resource and lineage RPC shapes, matches resource
identity/version, and whitelists public editorial fields. It rejects private
review/evidence/Auth fields and credential signatures. This projector is a data
boundary, **not publication authorization**: the later publishing operator must
read real approved releases and bind them to the quality gate.

Public instructions have platform setup, inputs/outputs, expected examples,
limitations, permission/privacy boundaries, explicit reuse rights, source links,
FAQ and minimal fork attribution. Clipboard transfers preserve the exact system
instructions followed by creator/license/source provenance. Definition downloads
preserve the specification, license, release version and attribution envelope.
No install, scheduled execution or tool access is implied by copying instructions.

Workflow publication currently fails closed until owned artifact delivery is
implemented and validated in the publishing phase. The portable schema and
private quality gate already support artifacts; a file path alone must not be
advertised as a usable import. This is unfinished delivery work, not a permanent
removal of workflow support from V1.

## Search and crawlability

- The view consumes an asynchronous search-provider interface with initial
  server-rendered results, cancellation, stale-response protection, retry and
  accessible pending/error states. Initial ranking remains literal and free.
- Whole Unicode-normalized terms, bounded queries, curated actual task aliases,
  stable tie ordering and 30-result pagination replace substring matching. `PR`
  cannot accidentally match `priority`. No semantic understanding is claimed.
- Eighteen affirmative task queries cover all ten disciplines. Four unsupported
  workflow queries return no fabricated match. Unit checks page through 100
  synthetic records without losing or duplicating a resource. The broader real
  launch inventory needs its own query evaluation during editorial acceptance.
- Public network connections use reviewed shared capability tags, with bounded
  nodes and edges. Local draft connections cannot silently become public claims.
- Result titles are actual detail links; a separate keyboard-accessible control
  inspects connections. Details have factual canonicals, breadcrumbs and safely
  encoded `CreativeWork` structured data without invented ratings/counts.
- Sitemap input is only validated public releases, using actual release dates.
  Search state has no indexable query URLs. Empty/thin landing pages stay noindex.
  Category, recipe, integration and platform editorial routes must pass their
  own content/indexing gates before sitemap inclusion.

Next 16 requires a nonempty static parameter list. For an empty catalogue, the
reserved generated not-found document is removed before delivery; a regression
test refuses to delete symlinks or unexpected content. The local synthetic QA
route is likewise removed from normal exports, and the export guard rejects any
remaining QA path. Neither a local preview nor a generated soft-404 is deployable.

## Browser and automated evidence — 7 October 2026

Chrome review covers 320/393/768/1024/1440px, with no horizontal overflow in the
inspected layouts. Resource facts were changed from inherited flex rows to a
scoped definition grid. Mobile navigation wraps; setup/instructions remain readable.
Result links and separate inspection controls retain at least 44px control targets.
Keyboard checks cover command submission, rapid query replacement, inspection
focus, detail navigation and native instruction disclosure. Draft copy is disabled.
The real browser clipboard matches the displayed attributed text in a clearly
labelled synthetic local fixture. Its actual downloaded JSON matches the fixture
specification/license and source attribution. These checks do not count as real
agent publication, creator activity or model-host tests.

Optimized loopback Lighthouse results:

| Page / device      | Performance | Accessibility | Best practices |   LCP |  TBT | CLS |
| ------------------ | ----------: | ------------: | -------------: | ----: | ---: | --: |
| Discovery / mobile |          99 |           100 |            100 | 2.03s | 16ms |   0 |
| Detail / mobile    |          99 |           100 |            100 | 2.05s | 30ms |   0 |
| Detail / desktop   |         100 |           100 |            100 | 0.59s |  0ms |   0 |

These measurements preceded the final small search/link/attribution refinements;
the final regression evidence is recorded in the implementation ledger. Lab TBT
is not field INP. Preview SEO scores are intentionally reduced by noindex/robots;
they do not satisfy production SEO acceptance. Firefox/Safari, real mobile
devices, screen-reader review and the production field metrics remain hardening
requirements. Browser clipboard denial/fallback remains a later manual check;
provider/privacy settings were not weakened to simulate it.

Local acceptance includes formatting, lint, strict typecheck, 39 Node and 11 Python
tests, the production static build and privileged-environment export inspection.
CI independently repeats the unchanged database isolation/extraction suite.

## Integrated gates that remain open

Real published browse → search → detail → copy/download E2E depends on moderation,
actual host verification and the publishing operator. Live saves, profiles,
reviews, reports and forks are the next community milestones. They are not
represented by decorative success controls. Static takedown latency, current
release/rights checks, immutable version delivery, artifact delivery, complete
editorial routes, social previews and production indexing remain required before
launch. Completing the local discovery foundation does not waive these gates.
