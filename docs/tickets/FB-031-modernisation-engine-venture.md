# FB-031 — Onboard the Modernisation Engine (Archon) as its own venture

**Status:** In review · **Phase:** 1 · **Depends on:** FB-003 (manifest format), FB-021 (repo access)
**Repo:** fountainbridge · **Branch:** `fb-031-modernisation-engine-venture` · One ticket = one branch = one PR.

## Why this matters (for the founder)
John's Archon-based **modernisation-engine** repo should show up in the studio as its own board, next
to ARCA and THE RESET, so its work is visible and driveable in one place — not a separate tool you have
to remember to check.

## Context
`wealthcx01/modernisation-engine` (Archon CLI base, default branch `main`) exists but is in no venture
manifest, so the studio doesn't know about it. Per venture-as-config (non-negotiable 5), a repo appears
by being declared in `ventures/*.yaml`. John's call: **its own venture**, not a repo under an existing one.

## Scope
- Add `ventures/modernisation-engine.yaml` — a Venture manifest (mirrors `arca.yaml`): id
  `modernisation-engine`, John as product authority, standard D7 approval matrix, one `engine` lane on
  the `modernisation-engine` repo, an Engineering department reading `docs/tickets`. Validates against
  the bcap-contracts Venture schema (CI `Validate manifests`).
- No studio code change — the venture loader picks up any `ventures/*.yaml`.

## Out of scope
- Read access (the GitHub App install / Railway creds is the FB-021 human step, shared across repos).
- Seeding the modernisation-engine ticket backlog on its default branch (a separate PR in that repo,
  the same pattern as ARCA's FB-030). Until then the board renders the accurate "no tickets on the
  default branch yet" state.
- The modernisation-engine pipeline work itself (FB-029, which lives in that repo, not here).

## Acceptance criteria
- [ ] `ventures/modernisation-engine.yaml` validates against the Venture contract (CI green).
- [ ] Once repo access is configured (FB-021), the studio shows a Modernisation Engine board (empty
      backlog state until its tickets are seeded).

## Verification
`make validate-manifests` + /review; manual check that the venture appears once access is on.
