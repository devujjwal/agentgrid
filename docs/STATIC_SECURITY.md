# Static document security

Production and optimized local builds parse every generated HTML document with
the pinned build-only `parse5` dependency. A policy immediately after the UTF-8
declaration permits each exact normalized inline script/style hash. External
scripts must be generated same-origin Next assets. Executable attributes, base
elements, malformed documents, duplicate policies, symlinks and unexpected script
origins fail the build. Export verification independently recomputes every policy;
changing an inline block after hardening invalidates the export. This is a build
integrity gate, not a replacement for validating/escaping untrusted content.

Script policy grants neither `unsafe-inline` nor `unsafe-eval`; event handlers are
explicitly denied. CSS attributes remain allowed for React layout/animation
properties. Inline style elements require hashes. Browser API requests use the
same-origin server boundary; no Supabase secret or direct privileged connection
is needed by client code. Third-party analytics or advertising require a separate
review of exact policy changes before installation.

The document meta policy supports static CDN delivery without invoking a Worker
for every page. Cloudflare permits only 100 `_headers` rules and 2,000 characters
per line, making one hash header rule per resource unsuitable for the planned
library. Header policy separately enforces `frame-ancestors 'none'`, base/object
denial and same-origin forms. Framing cannot be enforced by a meta policy.
Function-backed agent/listing responses attach the shared security headers
explicitly because Pages does not apply `_headers` to Function-generated responses.

Sources: [Cloudflare headers](https://developers.cloudflare.com/pages/configuration/headers/),
[CSP meta delivery](https://www.w3.org/TR/CSP3/#meta-element),
[script hashes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src).

The policy intentionally trusts same-origin script bundles. Do not serve user
uploads or executable user content on that origin. A CSP cannot make a compromised
approved bundle safe. Meta policies do not support all header/reporting features;
Lighthouse retains an advisory to prefer header delivery. This tradeoff is explicit,
not a claim of equivalent reporting or a reason to weaken the policy. Future
hosting changes can move the same per-document policies into response headers.

## Acceptance evidence

The optimized synthetic preview successfully hydrated, completed disposable email
sign-in, navigated to the private workspace and filtered discovery to Retrieval
Study Coach without console errors. The local-only `/qa-csp/` fixture allows its
approved bootstrap and rejects dynamic evaluation, an injected inline script and
an inline event handler. The fixture is served only by the disposable synthetic
preview server; it is not an application route or exported asset.

Mobile Lighthouse: performance 99, accessibility 100, best practices 100,
LCP 2.0s, TBT 30ms, CLS 0. Preview SEO 63 is intentional because indexing is
blocked. CSP-XSS passes with advisory notes about meta delivery and obsolete
browser fallback. No obsolete-browser `unsafe-inline` fallback is added.
Evidence is retained locally in `docs/evidence/phase7-csp-*`.

Provider delivery, actual public resources, cross-browser testing and field INP
remain launch gates. This work adds no runtime dependency or per-page Worker call.
