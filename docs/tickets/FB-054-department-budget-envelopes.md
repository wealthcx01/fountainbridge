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

**Not met. The PR is a draft.** A 10-specialist review (2026-07-31) found 14 criticals on this
branch. The arithmetic is sound; the *inputs* are not — and a budget gate is only as trustworthy as
its least-protected input.

- [ ] Each department carries a spend envelope, and a spend approval shows the envelope check.
      **NOT MET.** The check is computed studio-side as designed, but every input to it is written by
      the party being gated:
      - `budgets.json` lives on the **same `foundry-approvals` ref the lane writes proposals to**.
        The agent can raise its own limit, change the currency, or delete its department's entry.
        `grant.json` on that same ref is HMAC-protected precisely because the executor's own header
        says "the lane can write ANY file… authority CANNOT rest on file contents." The spending
        limits got no equivalent.
      - **The gate fails open on a missing or malformed price.** Omitting `amount_minor`, or writing
        it as a string or float, yields *no check at all* — a £5,200 send renders as an unpriced,
        fully-clear action. A test in this branch blesses that as intended.
      - **`department` is unvalidated free text**, so `"Sell"` or `"marketing"` misses the envelope
        lookup and the spend is neither checked nor accrued. The agent picks whether it is budgeted.
      - **Lane-authored `checks` render identically to the studio-computed one**, so an agent can
        write `{"name":"sell budget envelope","passed":true,…}` and show a forged clearance.
- [ ] A department nearing/over its envelope is flagged on the board.
      **NOT MET, three ways.** Spend is read from `venture.repos[0]`, but in both `arca.yaml` and
      `the-reset.yaml` the `sell` department — the only one with `gate: activegraph` and a
      `postmark` connector, i.e. **the only one that spends money** — has its own repo. So every Sell
      approval lives on a ref the studio never opens and the card renders a confident `within — 0%`.
      **The e2e fixture concealed this** by putting the sell approval under the `repos[0]` key.
      Separately, the over state has **no visual weight at all**: `data-budget-state` has no CSS
      behind it, so 108% renders in the same muted grey as 4%, while every other alert state in that
      same component sets `--color-warn`/`--color-error`. And the board passes `pendingMinor: 0`
      while the card includes it, so the two disagree by construction — `e2e/budgets.spec.ts` asserts
      exactly that disagreement, against a comment claiming they never can.

## Review findings (2026-07-31) — what must be resolved before this can ship

1. **Move envelopes off the lane-writable ref** (venture manifest, studio config, or attest
   `budgets.json` with `FOUNDRY_APPROVAL_SECRET` the way grants are attested).
2. **Fail closed on an unreadable price**: distinguish absent from malformed, and emit a
   *non-passing* check rather than omitting it. Same for an unknown department.
3. **Fix repo selection** — load approvals and budgets per `DepartmentSummary.repo`, and render
   "not readable" rather than `0%` for any department whose repo was not fetched.
4. **Window spend by the period.** `period` is a display-only label; `committedSpend` sums all time.
   A venture spending exactly on budget reads 100% in month 1 and 1200% in month 12, at which point
   every action is permanently `✗ over` and the one runaway is indistinguishable from twelve routine
   sends. Until timestamps are carried, do not render the period string.
5. **Count sibling pending spend.** Ten £1,000 proposals each read `within — 21%`; approving all ten
   spends £10,000 and no card said so. This falsifies the stated rationale for computing the check
   studio-side, which named exactly this failure mode.
6. **Treat a missing currency as unknown, not as the envelope's** — `envelopeCheck`'s guard
   short-circuits on null, so an unpriced-currency $10,000 send renders `over — 208% of £4,800`.
   Normalise and validate currency; exact string equality lets `"gbp"` drop spend from the total.
7. **Make over-budget visible** — drive colour and weight from the state, and give `nearing` a
   marker. Distinguish within/nearing/over without relying on reading a 13px muted mono sentence.
8. **Distinguish a corrupt `budgets.json` from an absent one** — both currently collapse to `[]` and
   render nothing, so the gate turning itself off is invisible (non-negotiable 10).
9. **Separate provenance in the UI** — render studio-computed checks distinctly from proposer
   claims, and render each check as its own element rather than a joined string (delimiters in a
   lane-authored `detail` can fabricate extra passing entries).
10. **Bind the approve click to the proposal the founder saw** — `proposalSha` is computed and never
    used; the server action re-reads and signs whatever is current, so a pre-grant swap is unguarded.
11. Fetch `budgets.json` once (it is read twice per render, and the two reads can disagree);
    `formatMoney` does a prototype-chain lookup, so a currency of `"constructor"` renders
    `function Object() { [native code] }4,800`.
12. Test gaps: the over/nearing boundary is never tested at exactly 100% of the envelope, and the
    board e2e asserts only the limit string and a state that holds for any implementation.

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

155 tests, lint, typecheck, build, the Playwright UI gate (36, two new), ticket parse, manifest
validation and shellcheck all green.
