# Social preview delivery

AgentGrid uses a 1200 × 630 brand PNG shared by Open Graph and Twitter cards.
The network illustration is decorative brand artwork, not a representation of
community activity, agent counts or popularity. No private profile data, draft
instructions, remote avatars or live community content is drawn into the image.
Page-specific public titles and descriptions remain in the surrounding metadata.

The reviewed asset is `public/social/agentgrid.png`. Regenerate it with
`node scripts/generate-social-image.mjs` using the pinned Next/React installation.
Generation uses Next's bundled ImageResponse renderer and default font, with no
external fetch, new package or paid image service. It does not run in the browser
or on each request. Source-level positioning is intentional for this fixed-size
image canvas and does not govern application responsive layout.

`verify-social-export.mjs` checks the actual public and local-preview exports:
PNG signature, dimensions, size bound, one Open Graph image and one Twitter image
per document, and the exact production-domain asset URL. The PNG is approximately
69KB. CI fails on missing or unexpected image references. Live public creator
responses use the same brand image while preserving the existing visibility and
escaping boundary. No new caching of creator data is introduced.

Before production acceptance, fetch the image on agentgrid.me and verify the
provider's Content-Type and byte size. Then inspect a public link in actual
sharing debuggers after crawl access is deliberately enabled. Local metadata
validation does not establish how an external service caches a previously shared
URL. The prelaunch noindex policy remains unchanged.
