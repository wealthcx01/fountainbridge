# FB-054 — Department budget envelopes (apply meridian's budgets)

**Status:** Shipped · **Phase:** 4 · **Depends on:** FB-048 (departments), FB-040 (budget cap), FB-044
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

**Narrowed, on John's call (2026-07-31), after three review passes returned 57 criticals without
converging.** The feature now DISCLOSES rather than judges. See `lib/budgets.ts` for the reasoning.

- [x] Each department carries a spend limit, and a spend approval shows the budget position. The
      limit lives in `ventures/budgets/<id>.yaml` in the **studio** repo, which venture lanes cannot
      write; the spend is summed where it can be, **named where it cannot**, and attributed to the
      venture rather than presented as verified.
- [x] A department over its limit is marked on the board — colour, weight, and the sentence itself.
      One string owner (`describe`), so the view adds no prefix and the words cannot drift from the
      state.

**What changed, and why.** The original design rendered a pass/fail policy check: "within budget" /
"over budget". A verdict must be either true or false, and the studio can support neither, because
almost every input belongs to the party being gated — the amount, currency and department are
lane-written; the timestamps are lane-written and unattested; a lane can write
`execution.json {status:'rejected'}` over its own grant and erase the spend; and a department with
its own repo is not read at all. Each guard added to compensate produced a worse failure than the
one it replaced:

| Guard added | Failure it created |
| --- | --- |
| Fail closed on anything uncountable | An ordinary **no-cost action** (`{amountMinor: 0, currency: null}` — a post, a tweet, every proposal predating this feature) was booked as spend in an unknown currency, so the gate went permanently red on any real venture. A lane could freeze a department by filing one costless proposal. |
| Judge on the queue | One unapproved £1,000,000 proposal failed every honest card beside it. |
| Escalate the marker on the projection | Colour, glyph, DOM attribute and words drifted apart; the announcement stuttered and contradicted itself. |

So the studio now says what it knows and whose number it is. That removes the incomplete-total
poisoning, the denial-of-approval, the pass/projection conflation, the board-vs-card contradictions
and the "checked by the studio" laundering — because there is no verdict left to be wrong.

`lib/budgets.ts` went from 576 lines to ~300, and the loader was split into `lib/budgets-load.ts`
(it reaches for `node:fs`, and the board renders `describe()` from a client component).

**Still open:**
- ❌ **Per-department repo selection.** Spend is read from `venture.repos[0]`, so a Sell approval in
      `arca-marketing` is invisible and the department reports £0. The disclosure now *says* it is
      the venture's report, which makes an incomplete figure less misleading — it does not make it
      complete.
- ⚠ **The reported spend is lane-authored** and no timestamp is covered by the approval HMAC.
      Future dates and non-ISO strings are rejected and the studio's own `granted_at` is preferred,
      which narrows the window-escape. Closing it needs FB-051's attestation work.

## Verification
103 unit tests over the budget layer and the approval boundary, including the wiring that mutation
testing showed was deletable (`toSpends` carrying `uncountable` and `committedAt`; the studio grant
timestamp winning over a lane-written execution one), the ENOENT-vs-other read split, a real file
planted outside the budgets directory for the path guard, previous-window exclusion, and the case
that broke the last design — **a free action must not read as uncountable spend**. Plus 3 Playwright
tests asserting arithmetic that moves: £4,000 reported + £5,200 queued against £4,800 → 192%, with a
previous-month £4,500 that must not appear and a free action that must not be flagged.

The UI gate caught a real defect during this rework: the proposal being decided was counted as both
pending and queued, reading 300% where it should read 192%.

155 tests, lint, typecheck, build, UI gate (37), ticket parse, manifest validation, shellcheck.
