# AgentGrid search audit — 11 October 2026

## Scope and evidence

This is **AgentGrid (agentgrid.me)**: Next.js 16 static export with Cloudflare Pages
and a separate publication/API Worker. It is not PicMagic. The audit branch starts
from `7beb5afd257a956f210b8cdaf6c7c36ed0ffd1f5`, matching the production release.
The primary checkout's unrelated documentation edit was preserved.

Live HTTP/source checks traversed **66 public discovery documents and 62 sitemap
URLs**, with no broken internal links, invalid canonicals or sitemap eligibility
errors reported by the existing live-discovery audit. The sitemap contains 38
released agents and 24 reviewed editorial URLs. This establishes accessibility,
not indexing, rankings or AI citations. Representative homepage, agent, category
and learning pages were also inspected in rendered mobile and desktop Chrome.
All shared public and private route templates were inspected in source; the
export gate checks every generated HTML document.

Google guidance used:

- [SEO learning paths](https://developers.google.com/search/blog/2026/10/seo-learning-paths)
- [SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [JavaScript SEO basics](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [AI features](https://developers.google.com/search/docs/appearance/ai-features)
- [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals)

Google AI surfaces use ordinary crawlability, indexing and useful accessible
content. No special AI schema, keyword stuffing or llms.txt requirement was added.
Search crawler permissions were not conflated with AI-training preferences.

## Already implemented and verified live

- Public pages deliver meaningful initial HTML, headings, descriptions, links,
  canonicals and JSON-LD rather than an empty JavaScript shell. Social previews
  have branded images and canonical destinations. Useful category, learning and
  connection guides link to agent details and each other.
- HTTP and www return 301 to HTTPS apex; `/agents` and index.html aliases use clean
  redirects. Missing resources return real 404s. Search/sort/page query variants
  retain the base directory canonical; filtering does not create unlimited routes.
- Production robots allows public crawling and excludes API, authentication,
  workspace, saves and QA. Private, legal and status pages retain noindex. Empty
  recipes and sparse platform/integration/MCP indexes intentionally remain
  noindex, follow; useful reviewed detail guides remain discoverable.
- Sitemap is accessible XML with canonical, indexable public URLs. Resource
  lastmod uses the actual recorded release timestamp; editorial pages omit dates
  rather than pretending that a build is a content update.
- Agent pages visibly state purpose, capabilities, inputs, outputs, supported
  hosts, requirements, costs, creator, version, reuse rights, examples, limitations,
  FAQs and sources. CreativeWork, BreadcrumbList, Organization, WebSite and Article
  graphs describe those facts; instruction packages are not falsely advertised as
  executable SoftwareApplications, endorsed products or rated installations.
- Staging returns `noindex, nofollow`. Sitemap requests bearing Googlebot,
  bingbot, OAI-SearchBot and PerplexityBot user-agent strings returned 200; this
  does **not** verify requests from those companies' actual crawler IPs.

## Verified issues and branch fixes

| Priority | Issue                                                                                                                                                    | Fix                                                                                                                                                                                                                                          |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Medium   | Directory results after the first 30 required JavaScript pagination, although category links already exposed all resources.                              | Add finite prerendered `/agents/page/2/`, showing the remaining eight agents, with crawlable previous/next links, unique metadata and a self canonical. Search/filter pagination remains interactive and does not create parameter URLs.     |
| High     | Published agent/recipe metadata could override the parent noindex rule in a nonproduction build. Nonproduction sitemaps still listed released resources. | Require both publication and the production build stage for detail indexing; emit an empty sitemap for every nonproduction stage.                                                                                                            |
| High     | The publication Worker previously had no allowed delivery path for static paginated directories.                                                         | Permit only manifest-bounded directory pages and exact known HTML/RSC filenames, including the observed Next.js `$d$page` payload. Unknown, encoded, out-of-range and private paths remain denied; detail withdrawal checks remain enforced. |
| Low      | Homepage source heading concatenated “want” and “an” across its visual line break.                                                                       | Add a text space without changing the layout.                                                                                                                                                                                                |
| Low      | Historical prelaunch documentation could be mistaken for current zero-resource status.                                                                   | Label it historical and link this audit; preserve the recovery record.                                                                                                                                                                       |

Sitemap inventory validation now includes the finite pagination routes. The branch
exports **90 documents, 2,470 valid internal links and 63 sitemap URLs**. The one
additional sitemap URL is **not live or submitted** until separately authorized
deployment. No production content, database, account permissions, analytics,
consent, execution flags or deployment settings were changed.

## Performance and browser checks

Cold simulated Lighthouse results from the live website:

| Page                  | Mode    | Performance | LCP    | TBT   | CLS |
| --------------------- | ------- | ----------- | ------ | ----- | --- |
| Homepage              | Mobile  | 96          | 2.72 s | 34 ms | 0   |
| Inbox Priority Triage | Mobile  | 99          | 1.68 s | 10 ms | 0   |
| Productivity category | Mobile  | 94          | 2.67 s | 81 ms | 0   |
| Reel creation guide   | Mobile  | 97          | 2.53 s | 38 ms | 0   |
| Homepage              | Desktop | 100         | 0.65 s | 0 ms  | 0   |
| Inbox Priority Triage | Desktop | 99          | 0.61 s | 0 ms  | 0   |

The first mobile agent run failed to paint; the completed retry is reported above.
Accessibility and SEO scored 100 in these runs. Agent best-practices scored 96,
with a CSP diagnostic and intentional no-store delivery preventing back/forward
caching. Do not weaken withdrawal protections or CSP merely to increase a score.
These are **lab results**, not field INP or verified Core Web Vitals compliance.
Some mobile LCP measurements exceed Google's 2.5-second target. A warm browser
trace measured 0.87-second homepage LCP and zero CLS; that is a different test and
does not replace the cold lab measurements.

A controlled local comparison of the original CSS imports with a consolidated
wrapper showed essentially unchanged LCP (4.31 versus 4.29 seconds) and the same
number of fetched stylesheets. That experiment was discarded. Localhost numbers
are not compared with production as evidence of an improvement. No oversized
hero images or external font downloads justified asset changes in this audit.

Production export previews were inspected at 393px mobile and 1440px desktop for
home, agent, category and learning templates, plus the new directory page. All
had meaningful rendered headings, correct canonical/index directives and no
horizontal overflow. Page-two navigation returned eight resources; searching for
“inbox” reset results correctly without generating a query URL. The Next.js CSS
preload warning remains; no hydration error was observed. API widgets in a static
local preview cannot exercise the production Worker and are not treated as live
API failures.

## Validation

- Offline frozen-lockfile dependency install passed; no dependencies were added.
- Production `pnpm check`: formatting, lint, type generation/typecheck, **262 Node
  tests and 18 Python tests**, static build, social/security and crawl gates passed.
- A separate build with no production stage passed with **zero sitemap entries**.
- `pnpm build:backend` and `pnpm test:backend` passed with synthetic credentials
  and outbound traffic only. New tests cover finite initial pagination, deployment
  indexing rules and Worker directory delivery boundaries.
- No database changes were made; remote migration or database tests were not run.
- Final browser/source checks cover the generated branch output; live checks
  describe the existing release, not these undeployed fixes.

## Remaining actions, ordered by impact and effort

1. **High impact / low effort:** review and authorize deployment of this branch
   through the existing release process, then rerun live HTTP/Worker checks on
   page two and its RSC payloads. Deployment and merge remain pending.
2. **High impact / low effort:** provide read-only AgentGrid Search Console access.
   The configured connector currently exposes only unrelated Economic Times
   properties; no AgentGrid URL Inspection, sitemap-fetch state, indexing or field
   performance can be verified here. Prior audit ownership/indexing evidence is
   historical, not reverified. No indexing requests or sitemap submissions occurred.
   Bing's current authenticated property state was likewise not inspected.
3. **High impact / medium effort:** examine real-user LCP/INP/CLS when sufficient
   data exists, especially homepage/category/guide mobile LCP. Profile actual
   blocking CSS and catalogue/graph interactions before changing delivery or
   removing protective caching rules. CDN/WAF access from genuine crawler IPs
   requires hosting logs or the authenticated search-console live test.
4. **Medium impact / editorial effort:** provide resource-specific last-tested dates
   and publishable evidence for the current versions. Editorial review and release
   dates are not runtime test dates. Keep claims about provider execution and
   automatic posting consistent with the disabled setup.
5. **Medium impact / medium effort:** strengthen existing task-intent pages with
   verified worked examples: redacted inbox triage, supplied-transcript clip
   planning and browser reels from users' own media. Link those examples to the
   appropriate category, instructions and limitations. Add a new landing page only
   when it has a distinct useful purpose and evidence; do not mass-publish generic
   agent/platform combinations or turn drafts into public content.

Raw live-discovery and Lighthouse evidence is retained locally under the project's
`launch` directory. Credentials, private publication evidence and recovery files
were neither read for this audit nor changed.
