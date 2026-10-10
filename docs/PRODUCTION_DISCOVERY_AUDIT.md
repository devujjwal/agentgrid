# Production discovery audit — 10 October 2026

## Evidence and scope

The baseline was fetched from **https://agentgrid.me/**, release
`37ff8e2fb5b856ac0748afe72357185786bf6cb7`, rather than inferred from source.
The audit traversed 65 public HTML documents, all 38 sitemap resources and their
linked category, learning and connection guides. It checked HTTP delivery,
canonical metadata, document landmarks, fragments, social metadata and JSON-LD.
Read-only checks used no account cookies, provider execution or paid APIs.

Reference plan: `CONTENT_STRATEGY.md`, `DISCOVERY_ACCEPTANCE.md`,
`PRODUCTION_RELEASE.md` and the production publication inventory. Historical
prelaunch statements in these documents are not current production status.

## Already delivered

- 38 distinct released instruction packages cover ten categories, with at least
  three per category. This satisfies the original 36-resource/category-coverage
  threshold; it does not establish popularity, ranking or universal reliability.
- Live public documents returned 200 and had distinct titles/descriptions,
  production canonicals, English language, one H1/main landmark, working internal
  destinations/fragments, branded Open Graph/Twitter images and parseable JSON-LD.
- Agent text contains a factual summary, purpose, capabilities, required inputs,
  outputs, host setup, version, first-party creator, reuse rights, costs, examples,
  limits, FAQs, source references and related resources. Observed synthetic host
  results and their limits are explicitly disclosed; no fake ratings or installs.
- Robots allows public crawling and excludes API/auth/workspace/sign-in/saves/QA.
  HTTPS and www redirect to the canonical domain. Explicit index.html aliases
  redirect to slash URLs. Unknown URLs return real 404s, not homepage soft 404s.
  Private/creator/legal documents are excluded from indexing and the sitemap.
- Search/filter state uses clean-page canonicals. Category links give crawlers
  access to resources beyond the first client-side result page. The pages.dev
  delivery alias retains production canonicals and rejects canonical-origin auth;
  it is an alternate delivery host, not a second canonical site.
- Search Console domain access is verified. URL Inspection explicitly reported
  the homepage **indexed**, and its live test reported **available to Google**.
  No other indexing, rankings or AI citations are established by this audit.

## Findings and corrections in this release

| Priority | Finding                                                                                     | Correction                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| High     | Sitemap listed only 38 agents; useful indexable hubs/category/learning guides were missing. | Explicitly reviewed discovery allowlist adds 24 URLs; production sitemap and its exact inventory gate both use it. No automatic indexing of future pages.                                                                                                    |
| High     | Six substantial connection guides retained blanket noindex.                                 | Permit indexing only for the reviewed paths during production builds and before their documentation-review expiry. Sources were rechecked against official provider documentation. General guides remain clearly separate from package compatibility claims. |
| High     | Empty recipes and sparse integrations/platform/MCP indexes were indexable.                  | Keep these four directories noindex, follow. No empty recipe is manufactured to fill the library.                                                                                                                                                            |
| Medium   | Bare `/agents` returned 404.                                                                | 308 to `/agents/`, preserving the query; other unpublished/withdrawn resource guards remain enforced.                                                                                                                                                        |
| Medium   | Agent graph omitted useful citations, capability and category relationships.                | Add visible-source citations, capability DefinedTerms, category membership, lineage when present and factual free-access metadata to CreativeWork. No SoftwareApplication/rating/run claim is invented for instruction packages.                             |
| Medium   | Agent category names were plain text.                                                       | Link them to the existing substantive category guides.                                                                                                                                                                                                       |
| Medium   | Home/agent/category hubs omitted og:url; homepage lacked site/entity graph.                 | Add canonical share URLs and factual Organization/WebSite identity. Existing images and visible layout are retained.                                                                                                                                         |
| Medium   | SVG map accessible names differed from their visible labels.                                | Associate names with the rendered labels; retain the full resource/action in the accessible description. Visual geometry is unchanged.                                                                                                                       |
| High     | Free local reel creation was discoverable only through a noindex workspace.                 | Add one practical learning page: `/learn/create-reels-from-your-own-media/`, with actual limits, local-file privacy, browser format caveats, review steps and an editor link. It makes no cloud generation or automatic-posting claim.                       |
| High     | Bing had no AgentGrid property.                                                             | Prepare the exact owner-approved homepage verification tag. Live verification and sitemap result are recorded in the final production evidence, not presumed from the tag.                                                                                   |

## Search engines and remaining checks

The original Search Console sitemap row reported **Couldn't fetch**, zero
discovered pages and no detailed HTTP cause. The XML was well formed and returned
200/application+xml to ordinary and Googlebot/bingbot/OAI-SearchBot/PerplexityBot
user-agent requests. Google's actual homepage live test succeeded. Re-submit the
updated sitemap after deployment and record its actual processing status; an
accepted submission is not a successfully processed sitemap or indexed inventory.

GSC Core Web Vitals reports explicitly say **not enough usage data** for mobile
and desktop. Initial production mobile Lighthouse: performance 96, accessibility
100, best practices 92, SEO 100; LCP 2.6s, TBT 10ms, CLS 0. Lab TBT is not field INP.
The report flagged a hosting-injected Cloudflare beacon blocked by the existing
CSP. Remove the injection at its originating setting if available; do not allow
an extra tracker by weakening CSP or introducing collection without consent.
Post-deployment measurements and any hosting correction belong in final evidence.

A discrete **last-tested timestamp/host-model record** is absent from the public
release contract. Pages show release dates and describe bounded observed tests,
but release/review/capture dates must not be relabelled as test dates. A future
approved public attestation should expose the actual date and exact tested version
from the private quality record while excluding raw/private evidence. This is an
AEO transparency gap, not a reason to invent a date or rewrite immutable packages.

Seventeen distinct external HTTPS references were checked. Four automated
requests encountered external bot restrictions (including FDA's abuse-detection
404); primary browsing retrieved the FDA, NOAA and OpenAI documents. Those
responses do not establish dead links. Citation freshness still requires ongoing
human editorial review, especially dated Gemini setup changes.

## Highest-impact next content

1. A factual **AgentGrid versus writing a prompt directly in ChatGPT** guide:
   compare versioned instructions, source-grounded examples, reuse rights and
   manual setup, with an actual worked task and honest current execution limits.
2. Publish a small set of genuinely tested **guided recipes**, starting with
   meeting notes → decisions → follow-up draft and transcript → clip plan → local
   reel. Each needs real handoff examples, rights and distinct outcome review;
   keep the empty recipes directory noindex until these exist.
3. Add contextual links from the relevant content category and transcript-clip
   agent to the reel tutorial, and from recipes to the exact tested versions.
4. Use real GSC/Bing queries and indexing exclusions to choose subsequent pages.
   Prioritize useful task examples over duplicate platform/category permutations.
   Earn relevant references from real users; no fabricated endorsements/backlinks.
5. Reassess field CWV when sufficient traffic exists and publish the bounded
   test-attestation fields. Review provider sources on their actual due dates.

## Reproducible validation

`pnpm check` runs formatting, lint, typecheck, tests and the static export gates.
`AGENTGRID_BUILD_STAGE=production pnpm build` also verifies the explicit 62-URL
production inventory against generated indexability. Backend workerd acceptance
checks routing/privacy and the directory redirect; CI also runs isolated database
and disabled-worker acceptance. `node scripts/audit-live-discovery.mjs <report.json>`
rechecks actual deployed public HTML, links, fragments, metadata, status probes and
bot user-agent responses, without credentials or mutations.

Noindex is intentional for private routes and thin directories. Robots is not an
access-control mechanism. A user-agent probe is not proof of verified crawler-IP
access. Sitemaps/canonical/schema eligibility does not guarantee search selection.
Google states that AI search needs ordinary crawl/index/snippet eligibility and
useful content; no special AI schema or AI text file is required. OpenAI and
Perplexity document separate discovery crawlers. No mass pages, keyword stuffing,
paid hosting, model calls or live social posts are introduced.

Primary references: [Google AI features](https://developers.google.com/search/docs/appearance/ai-features),
[Google structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies),
[OpenAI crawlers](https://developers.openai.com/api/docs/bots),
[Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers),
[Bing sitemaps](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed).
