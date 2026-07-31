# FB-054 — Department budget envelopes (apply meridian's budgets)

**Status:** In progress · **Phase:** 4 · **Depends on:** FB-048 (departments), FB-040 (budget cap), FB-044
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

Met in code, with two gaps stated below. **PR #54 stays a draft** until the per-department repo gap
is closed — a department can still show a confident `0%`.

- [x] Each department carries a spend envelope, and a spend approval shows the envelope check.
      Envelopes live in `ventures/budgets/<id>.yaml` in the **studio** repo, which venture lanes
      cannot write; the check is computed studio-side and **fails closed** on every agent-supplied
      input it cannot trust (unreadable price, no price, unknown department, unstated or foreign
      currency, unreadable budgets file), and never returns "no check at all" — an absent line used
      to be the cheapest bypass available.
- [x] A department nearing/over its envelope is flagged on the board — in colour, in weight, in a
      glyph, in a screen-reader-only state word, and in the sentence itself. The marker escalates on
      what the queue would do, so a department at 83% with £5,200 waiting is flagged rather than
      reading calm.

**Gaps (not met):**
- ❌ **Per-department repo selection.** Spend is read from `venture.repos[0]`, so a Sell approval in
      `arca-marketing` is invisible and that department reads `0%`.
- ⚠ **The numerator is still lane-authored.** The limits moved out of the lane's reach; committed
      spend is still summed from grant/execution records written on the venture box, and no
      timestamp is covered by the approval HMAC. Future dates and non-ISO strings are now rejected
      and the studio's own `granted_at` is preferred, which narrows the window-escape but does not
      close it. Closing it needs FB-051's attestation verification.

## Review findings — rework status (2026-07-31)

**Fixed in the rework (commit on this branch):**

1. ✅ **Envelopes moved off the lane-writable ref.** They now live in `ventures/budgets/<id>.yaml`
   in the **studio** repo, beside the venture manifests, where venture lanes have no write access —
   changing a budget goes through this repo's own PR + CI gate. `readBudgets` is gone from
   `ApprovalSource` entirely, so the venture ref can no longer supply limits.
   *(A subdirectory, not `ventures/<id>.budgets.yaml`: the manifest validator globs `ventures/*.yaml`
   and `loadVentures` reads the same directory, so a sibling file was parsed as a malformed Venture
   by both — caught by CI during the rework.)*
2. ✅ **The check fails closed.** `envelopeCheck` returns a **non-passing** check — never `null` —
   for an unreadable price, an unknown department, a missing envelope, an unstated currency, or a
   foreign currency. `null` is now reserved for a genuinely free action. `amountMinor` is
   `number | null` with a separate `priceUnreadable` flag, so "free" and "we could not read the
   price" are no longer the same value.
3. ✅ **Department validated against the manifest.** `attachEnvelopeChecks` takes the venture's
   declared department ids; anything else reports "not a department of this venture" instead of
   silently exempting the spend. Envelopes keyed to a department the venture does not declare are
   surfaced on the board as configured-but-enforcing-nothing.
4. ✅ **Spend windowed by period.** `period` is now a typed `monthly | quarterly | yearly | all-time`
   and is **enforced** by `withinPeriod`, with the label rendered from the same value ("this month"),
   so the numerator and denominator finally describe the same window. An undated v0 spend counts in
   every window rather than none — understating a budget is the direction that hurts.
5. ✅ **Sibling queued spend counted.** Every card and department line now carries
   "…; 192% if everything queued is approved", and the board's warning marker escalates on the
   projected state, so a department at 83% with £5,200 waiting is flagged rather than reading calm.
6. ✅ **Currency normalised and validated** (ISO-4217 shape, trimmed, upper-cased) so `"gbp "` cannot
   dodge the comparison. An **unstated** currency is now uncountable rather than assumed to be the
   envelope's, and both foreign and unstated spend are named in the caveat.
7. ✅ **Over-budget is visible** — colour from `--color-error`/`--color-warn`, weight on `over`, and
   a per-state glyph (`✓ ◑ ⚠ ·`) so the states are distinguishable without relying on colour.
   `nearing` has a marker for the first time. Sizes use the token scale.
8. ✅ **Corrupt is distinguishable from absent.** `loadEnvelopes` returns `{ envelopes, error }`; a
   file that exists but cannot be read renders a board-level warning telling the founder no spend is
   being checked. A limit written in pounds instead of pence is reported by name.
9. ✅ **Provenance separated in the UI.** Studio-computed checks render in their own list labelled
   "checked by the studio"; the proposer's own claims render separately under "stated by the
   proposer". Each check is its own element, so a delimiter inside a lane-authored string can no
   longer fabricate extra passing entries.
11. ✅ `budgets` is read **once** and threaded through (the double fetch is gone); `formatMoney` uses
    `Object.hasOwn`, so a currency of `"constructor"` no longer renders
    `function Object() { [native code] }4,800`.
12. ✅ **Tests pin the boundaries**: exactly 100% of the envelope, one penny over, one penny below
    the nearing threshold, and the e2e now asserts arithmetic that moves (£4,000 committed +
    £5,200 queued against £4,800 → 83% / 192%) instead of the limit string.

**Still open — deliberately not in this pass:**

- ❌ **Per-department repo selection (finding 3).** Approvals are still read from
  `venture.repos[0]`, so a Sell approval living in `arca-marketing` is invisible and the department
  reads a confident `0%`. This is the one remaining finding that can still show a wrong number, and
  it needs `loadApprovals` to fan out across department repos — a change to the approval-loading
  architecture that touches FB-046's read path, not just this feature. **Next.**
- ❌ **Binding the approve click to the proposal the founder saw (finding 10).** `proposalSha` is
  computed and unused; the server action re-reads and signs whatever is current. That is the FB-046
  approve path rather than the budget feature, and it overlaps FB-051's confused-deputy finding —
  it should be fixed once, there.
- The e2e still gates the fixture source on `E2E_TEST_LOGIN`; `NODE_ENV` is unusable because
  `next start` sets it to production for the UI gate too.

## Verification
34 unit tests over the budget layer and the approval boundary (envelope loading from the studio repo
incl. a corrupt file and a path-escape attempt; currency normalisation; period windowing incl. an
undated spend; committed-status rules; every fail-closed branch; the over/nearing/within boundaries
at exactly the limit, +1 and -1; the `Object.hasOwn` symbol lookup) + 3 Playwright tests asserting
real arithmetic on the real render. 156 tests, lint, typecheck, build, UI gate (37), ticket parse,
manifest validation and shellcheck all green.

**Not yet run against a real venture.** The fixture proves the maths and the render; no venture has
a `ventures/budgets/*.yaml` in production except arca's, and no lane has yet written a priced
proposal.
