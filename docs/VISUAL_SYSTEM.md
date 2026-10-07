# AgentGrid visual system

## Direction

The interface is a task network: warm paper, deep green ink, precise hairlines,
category glyphs and explicit connections. A restrained serif emphasis on “do?”
adds an editorial voice to the otherwise practical sans-serif typography. System
fonts avoid downloads, font swapping and third-party requests. Semantic tokens
in `src/app/tokens.css` own the palette and type families.

The search command is the primary entry point. The network is a complementary
way to inspect relationships, alongside a complete semantic resource list. It
never substitutes position, color or a glyph for an accessible resource name.
No simulated activity, install counts, reviews or popularity decorate the map.

## Interaction and responsive rules

- Desktop displays at most 24 resources. Selection and search communicate real
  catalogue matches; connections describe explicitly curated shared capabilities.
- Below 1,101px the map and inspector stack to preserve legibility. Phones display
  the selected match and up to three matching connected neighbors. Previous/next
  controls traverse the complete matching list without stealing keyboard focus.
  Controls disable when there is only one result.
- Selecting a node or resource row focuses the inspector after React commits and
  positions its heading in view. Search submission focuses the named results
  region. Empty results explain the state and offer a working reset.
- A single short selection pulse communicates changed focus. Hover/focus reveals
  the selected connection. There is no continuous decorative animation, WebGL,
  pointer tracking loop or animation dependency.
- The SVG chunk loads near the viewport through IntersectionObserver. Its reserved
  canvas prevents shifts; offscreen animation pauses. If the chunk cannot load,
  the resource list remains available with a clear fallback message.
- Reduced motion suppresses selection animation and transitions and uses immediate
  scrolling. The map and list retain the same information and controls.

The initial curated layout is a foundation. Broader library layouts, category
constellations, distribution signals and community flows must be reviewed again
with real published data in subsequent phases; they are not visually accepted
merely because these ten drafts look correct.

## Local-only acceptance environment

`pnpm design:build` creates an optimized snapshot in the ignored
`.agentgrid-local-preview` directory. `pnpm design:preview` serves it on
127.0.0.1:3027 only. The flag is rejected in CI; public export checks reject both
its visible notice and machine marker. Drafts project only bounded discovery
metadata into this preview. Instructions, private review evidence, identities and
credentials are not part of the discovery DTO.

The normal build still exports the infrastructure proof. No draft has become an
indexable resource or public deployment. This distinction is deliberate until
publication, distribution and editorial gates are met.

The local static server negotiates gzip for text assets. Its compressed delivery
is used for lab measurement; this does not prove CDN performance or production
security headers. Production delivery must be audited after deployment.

## Browser iteration and evidence — 7 October 2026

Chrome inspection covered 320, 393, 768, 1,024 and 1,440 CSS pixels. Corrections
included overlapping motif copy, narrow-screen heading wrapping, the command
placeholder, stacked tablet layouts, mobile SVG label/hit area sizing, disabled
single-match navigation, SVG accessible-name whitespace and selection focus.
No horizontal overflow was observed at these tested sizes.

Keyboard checks exercised task submission, empty results and reset, native
category selection, resource inspection and mobile next selection. Search moves
focus to `discovery-results`; selection now places the inspector at approximately
32px from the viewport top, with its heading visible. Mobile next selection keeps
focus on the initiating control.

Chrome Rendering emulation confirmed `prefers-reduced-motion: reduce` matches:
selection animation computes to `none`, root scrolling to `auto`, and node
transition duration to the near-zero fallback. The emulation and temporary
viewport overrides were reset after testing. Accessibility-tree inspection
verified named resources and landmarks; a full assistive-technology/user audit
remains a hardening gate, not a claim of WCAG certification.

Local screenshots are intentionally ignored under `docs/evidence/`:
`phase2-desktop.jpg` and `phase2-mobile.jpg`.

| Lighthouse 13.5 lab run | Mobile | Desktop |
| ----------------------- | ------ | ------- |
| Performance             | 99     | 100     |
| Accessibility           | 100    | 100     |
| Best practices          | 100    | 100     |
| LCP                     | 2.03s  | 0.43s   |
| CLS                     | 0      | 0       |
| Total blocking time     | 25ms   | 0ms     |

Reports are local `/private/tmp/agentgrid-mobile-final.json` and
`/private/tmp/agentgrid-desktop-final.json`. Label/content-name matching passes.
The mobile transfer total is approximately 155KiB. The earlier uncompressed
local server measured 87 performance / 4.1s LCP; compression corrected the
measurement setup. No build ran concurrently with the final timing runs.

SEO scores 63 because this private preview intentionally sends noindex and
blocks crawlers. That is not production SEO acceptance. TBT is a lab measure,
not measured field INP. Real user Core Web Vitals, public SEO, production network
behavior, cross-browser and full community journeys remain later phase gates.

The final small focus correction was rebuilt and checked in the browser after
these timing reports; it changes selection scrolling, not load layout/content.
