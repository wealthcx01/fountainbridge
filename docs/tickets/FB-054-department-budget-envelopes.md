# FB-054 — Department budget envelopes (apply meridian's budgets)

**Status:** Planned · **Phase:** 4 · **Depends on:** FB-048 (departments), FB-040 (budget cap), FB-044
(gate checks) · **Repo:** fountainbridge · **Branch:** `fb-054-department-budget-envelopes` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Each part of the venture — Build, Sell, Scale — has a spending limit you set, and the system respects
it: a spend that would blow the envelope surfaces as a check on the approval, and shows in your brief.
No runaway costs.

## Context
Meridian attaches a budget envelope per department (`Company.budgets`, `docs/ideas-from-meridian.md`).
Our manifest already splits Build/Sell/Scale (FB-048) and the lane has a wake budget (FB-040) — this
adds a per-department spend envelope that feeds the gate + the founder brief.

## Scope
- A per-department **envelope** (limit + running spend) in the manifest/state (build/sell/scale).
- The gate (FB-044/051) surfaces an **envelope policy check** on a spend/send approval ("within Sell
  envelope — 104% of £X"), so the founder sees the budget impact at approve-time.
- The founder brief (FB-042) shows budget risk per department.

## Out of scope
- The lane model-spend cap (FB-040, done). Payment execution (Phase 4b + gate).

## Acceptance criteria
- [ ] Each department carries a spend envelope; a spend approval shows the envelope check.
- [ ] The founder brief flags a department nearing/over its envelope.

## Verification
`/review` + CI + a fixture: an over-envelope spend renders a failing check on the approval card.
