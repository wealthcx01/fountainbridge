# FB-041 — gstack RPIV loop in the lane (fully apply gstack + Cole Medin's RPIV)

**Status:** Planned · **Phase:** 2 · **Depends on:** FB-039/040 (lane runtime + autonomous wake),
FB-050 (gbrain) · **Repo:** fountainbridge (+ venture VM) · **Branch:** `fb-041-gstack-rpiv-lane-loop`
One ticket = one branch = one PR.

## Why this matters (for the founder)
This is what makes the agent's work *good*, not just done: it plans before it builds, and reviews +
tests its own work before it ever reaches you. The difference between "a bot changed a file" and "a
disciplined engineer shipped it."

## Context
Today the lane is a raw `claude -p` that implements a ticket directly (FB-040) — the thin version. The
Bruntsfield Loop (`docs/jstack-bruntsfield-method.md`, `docs/founder-to-lane-execution.md` §5) calls
for the FULL gstack/RPIV loop. This ticket applies gstack **fully**: the unchanged engine, run per the
method — no fork (method doc §2).

## Scope (fully applies gstack + RPIV)
- **Install gstack on the venture box** (skills suite; the same tooling the studio-build lanes use),
  pinned + upgradeable on the normal cadence.
- **The lane runs the real loop**, not a bare prompt: **RESEARCH** (gbrain, FB-050) → **PLAN** (`/plan`,
  or `/plan-ceo-review` for large/ambiguous asks) producing a PRP (FB-052) → **IMPLEMENT** one
  ticket = one branch = one PR → **VALIDATE**: `/review` (staff-engineer audit incl. adversarial) +
  `/qa` **before the PR opens** (non-negotiable 9) — no `--no-verify`.
- **Department routing**: the lane picks a ticket's `department` (build/sell/scale) and works it in the
  right repo/queue (with FB-045).
- **Fail-loud**: `/review` or `/qa` findings the lane can't resolve → a `blocked` RunReport with the
  reason, not a quietly-shipped PR.

## Out of scope
- The gbrain install itself (FB-050) and the PRP-quality layer (FB-052) — depended on here.
- External-action execution (that stays behind the FB-044/046 gate).

## Acceptance criteria
- [ ] gstack installed on the box; the lane invokes `/plan` + `/review` + `/qa` (verifiable in the run log/RunReport).
- [ ] A lane PR is only opened after `/review` + `/qa` pass; a failing gate → a `blocked` RunReport, no PR.
- [ ] The lane routes a ticket to its department's repo/queue.

## Verification
`/review` + CI; live on ARCA's box: a Todo ticket goes RESEARCH→PLAN→IMPLEMENT→(/review+/qa)→PR, with
the review/qa evidence in the RunReport.
