# FB-054 — Department budget envelopes (apply meridian's budgets)

**Status:** In review · **Phase:** 4 · **Depends on:** FB-048 (departments), FB-040 (budget cap), FB-044
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
- [x] Each department carries a spend envelope, and a spend approval shows the envelope check. The
      envelope lives in venture **state** (`budgets.json` on the `foundry-approvals` ref) — see the
      note below on why not the manifest. The check is **computed studio-side at load time**, not
      read from the proposal: FB-044's `checks[]` are written by the proposing lane, and a lane
      asserting its own spend is within budget is the proposer marking its own homework — and a
      stale snapshot besides, since two proposals written an hour apart can each be "within budget"
      and blow the envelope together.
- [~] A department nearing/over its envelope is flagged **on the venture board's department cards**
      (`dept-<id>-budget`, with a `data-budget-state` of within/nearing/over). The *founder brief*
      named in the scope does not exist yet — it arrives with FB-042, which is blocked on
      bcap-contracts. Flagging was put on the surface the founder actually looks at today rather
      than inventing FB-042's brief inside this ticket.

**Why state and not the manifest.** The scope allows "manifest/state". `Department` in
`schema/Venture.schema.json` is `additionalProperties: false` and pinned to bcap-contracts 0.1.0, so
a `budget` field there is a change to *that* repo (non-negotiable 7) — the same dependency that has
FB-042 blocked. State is the half that ships without waiting.

## Verification
**Done in this PR (local):** 23 unit tests over the envelope logic — parsing (a missing/garbage
budgets file reads as "no budget", never as over-budget; a float limit is dropped rather than
mispricing the gate 100×; a zero limit is a real budget); which statuses count as committed spend
(proposed excluded, so an unapproved ask can't squeeze out real work); nearing/over thresholds; a
zero limit that would otherwise divide by zero; and money formatting. Plus the ticket's own
verification as a **Playwright test against a fixture**: a £5,200 send against Sell's £4,800 monthly
envelope renders `✗ sell budget envelope — over — 108% of £4,800 per month` on the approval card,
alongside the lane's own passing check, with the card reading "1 policy check need a look".

Two things this ticket fixed on the way past: the approval card was **discarding every check's
`detail`**, so a founder saw *that* something failed but never *by how much* — which would have
defeated this ticket's entire point; and FB-046 shipped the approval read model with **no fixture
source**, so the approval card had no deterministic UI coverage at all. Both are now covered.

148 tests, lint, typecheck, build, the Playwright UI gate (36, two new), ticket parse, manifest
validation and shellcheck all green.
