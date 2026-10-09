# First-party package reuse decision

Approved by the owner on 2026-10-09: **custom restrictive terms**. The earlier
CC BY 4.0 proposal was rejected and must not be applied to first-party packages.

The AgentGrid Internal Use and Hosted Fork License 1.0 allows personal and
commercial workflow use, copying into supported platforms and internal adaptation.
It expressly allows attributed public forks **within AgentGrid** under the same
conditions, preserving source, version and lineage. General republishing,
redistribution, resale, sublicensing, competing dataset/directory scraping and
commercial reproduction of the package library are not granted. Workflow outputs
are not restricted by this instruction-package license; other rights still apply.

The versioned full text is `/licenses/agentgrid-internal-use-v1/`; the portable
notice is in `src/domain/legal.ts`. All 36 unpublished first-party definitions now
carry that exact notice. Recipe dependency digests were refreshed because the
license is part of the exact tested specification. No host-test evidence or release
was created by this update. Copy/export/fork actions still require publication.

`license.public_fork_scope: "agentgrid-only"` is an optional backwards-compatible
field. It is valid only for custom terms with use, modification and public forks
permitted and general redistribution denied. Omission retains existing general
fork semantics. Standard open licenses cannot carry this restriction. The database
and Zod parser enforce the same boundary; forks retain their entire source license.
Package export remains denied when general redistribution is denied.

Original community drafts still default to unselected permissions. Creators choose
their own license. This license does not cover application code, branding, general
editorial pages or third-party material. The application repository remains private.
Selected future first-party releases can explicitly use another license without
changing the data model. Never silently rewrite an immutable released version or
its historical grant. Update terms with a new version/path when the grant changes.

Operator identity is centralized separately from each historical license notice.
A future incorporation/transfer needs a new operator configuration and appropriate
notices; it must not retroactively replace the named grantor in an old license.
