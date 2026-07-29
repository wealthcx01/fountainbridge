# FB-045 — Provision Sell/Scale repos + make the loop department-generic (operationalise the 3 surfaces)

**Status:** Planned · **Phase:** 4 · **Depends on:** FB-041 (dept routing in the lane), FB-048
(surfaces) · **Repo:** fountainbridge (+ venture repos/VM) · **Branch:** `fb-045-department-repos-and-routing`
One ticket = one branch = one PR.

## Why this matters (for the founder)
Today only *building* is worked automatically. This makes **selling** and **scaling** first-class too:
a marketing ticket you describe actually gets worked, shipped through the same discipline.

## Context
FB-048 declared Build/Sell/Scale + renders them; the composer can file to any (it's generic). But
Sell/Scale have no repos and no lane works them. This provisions the repos + points the loop at them —
the operational half of the three surfaces.

## Scope
- **Provision the department repos** for a venture (e.g. `arca-marketing`, `arca-ops`; or the-reset's
  `thereset-marketing`) with `docs/tickets/` + `context/`/`library/`; add them to the manifest `repos`
  so the surfaces flip from "coming" to active (FB-048).
- **Clone them into the lane runtime + the department's gbrain partition** (FB-050); the autonomous
  lane scans + works each department's queue (FB-041 routing).
- **Sell content (4a)** runs the normal PR loop on the venture's real domain CI (where we beat
  Cofounder — production discipline, not a review Library). **Sell sends + Scale mutations** route to
  the gate (FB-044/051); reads are free.

## Out of scope
- Real send transport (Phase 4b). The full ActiveGraph runtime (FB-051).

## Acceptance criteria
- [ ] A venture's Sell (and Scale) repo is provisioned + in the manifest; the surface reads "active".
- [ ] The autonomous lane works a Sell content ticket end-to-end (PR on the marketing repo's CI).
- [ ] A Sell send / Scale mutation ticket routes to the approval gate, not auto-executed.

## Verification
`/review` + CI; a marketing Todo ticket → the lane opens a PR on the marketing repo; a send ticket → an approval.
