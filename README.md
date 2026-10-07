# AgentGrid.me

The discovery and distribution network for reusable AI agent packages.

Private application source. Production canonical: https://agentgrid.me.

## Implementation status

Phases 0–2 are validated. Phase 3 publishing integration and Phase 4 identity/workspace
are in progress. The discovery foundation passed private CI and merged.
See [the implementation ledger](docs/IMPLEMENTATION.md)
for phase acceptance evidence. This repository is not yet a launched product.

## Repository identity

Commit identity and authentication are repository-local and use the verified
personal account `devujjwal` / `devujjwal1989@gmail.com`. The machine's global work
identity must remain unchanged. Repository hooks verify identity and the global
baseline before commits, and authenticate/verify the private destination before
pushes. Hooks are an additional safeguard, not a security boundary.

Cloning to a new machine requires explicit repository-local identity/authentication
setup and recording a new global baseline before hooks can pass. Never work around
a failing guard with `--no-verify`.

## Licensing

Application rights are reserved. Agent packages have separate explicit licenses.
Community publication does not automatically impose an open license.

## Local development

Use Node 24.2+ within the pinned major and pnpm 10.30.3. Run `pnpm install
--frozen-lockfile` and `pnpm check`. `pnpm test:database` uses isolated disposable
PostgreSQL fixtures; it does not connect to the shared project.

For the unpublished visual workspace, run `pnpm design:build` then
`pnpm design:preview` and open http://127.0.0.1:3027/. It cannot run in CI or
be exported through the public delivery gate. See
[visual acceptance evidence](docs/VISUAL_SYSTEM.md).

`pnpm build:backend` separately compiles the Pages Functions boundary without
deploying or reading credentials. See [identity acceptance](docs/IDENTITY_ACCEPTANCE.md)
for session/CSRF/isolation tests, conservative free-tier budgets and remaining
live journeys. The owner-only local provider harness requires the guarded backend
migrations and explicit `--owner-live-auth`; it seeds no profile or public activity.
