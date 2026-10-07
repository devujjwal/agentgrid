# AgentGrid.me

The discovery and distribution network for reusable AI agent packages.

Private application source. Production canonical: https://agentgrid.me.

## Implementation status

Phase 0 infrastructure is validated. Phase 1 contracts/content work is next.
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
