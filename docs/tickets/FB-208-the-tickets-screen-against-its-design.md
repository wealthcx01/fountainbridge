# FB-208 — the tickets screen against its design

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-06, R-07, R-08) ·
**Branch:** `fb-208-the-tickets-screen-against-its-design` · One ticket = one branch = one PR.

Second in the reviewer's order, after FB-207. FB-203 did this pass for the desk; this is the same
pass for the screen a founder reaches from it.

## What was found

> **R-06 — Filter tabs are buttons.** Needs you / Under way / Settled / All render as `.btn` and
> `.btn-primary` — four buttons where the design has text tabs on a hairline, the current one
> underlined 2px accent, counts in mono.
>
> **R-07 — Row shape.** The meta line concatenates id · status · progress · waiting · count, and
> omits the surface. **On ARCA that is one line that wraps to three.**
>
> **R-08 — Proven should be a fact.** *"Your team's own checks ran before this reached you"* is
> printed for every ticket regardless. `acceptWork` already carries `headSha` and refuses a moved
> head.

R-08 is the one that matters most. A sentence printed for every ticket whether or not it is true is
not reassurance — it is the studio saying something it has not checked, on the screen where a founder
decides whether to accept work.

## Scope

**The tabs.** 13px sans, count in mono 12px, a hairline under the row, the active tab a 2px accent
underline. `role="tab"` stays — the change is what they look like, not what they are.

**The row.** Title; then `ref · surface` in mono/mute; waiting time right-aligned in amber. Progress
text moves into the detail's eyebrow. **Status does not repeat on every row** — it is the filter.

**Proven says what is known.** *"Unchanged since you last read it"* when `headSha` matches;
*"Changed since you last read it — re-read"* in amber when it does not. And **Costs** stays "Nothing"
only for internal work; a send states its metered cost from the approval.

## Out of scope

The trace line above the decision (R-04) — that is **FB-184**, which already exists and now carries
the exact copy. And the ticket thread (R-05) — that is **FB-209**.

## Acceptance criteria

- [x] No `.btn` in the filter row; the active tab is an underline and is still `role="tab"`.
- [x] A ticket row on ARCA is one line at 1440px, and names its surface.
- [x] Proven states a fact about *this* ticket. — **but not the wording R-08 asked for; see below.**
- [ ] A send's Costs states the money, not "Nothing". — **not done. FB-214.**
- [x] Read at 1440×1000 and 393×851, with the readings recorded.

## Done, 2026-09-09

**The tabs.** Text on a hairline, the active one underlined 2px in the accent, counts in mono.
`role="tab"` unchanged. `.btn` and `.btn-primary` had made the four most button-shaped objects on this
screen the ones that only narrow a list — beside a detail pane whose buttons merge finished work into
a founder's product.

**The row.** Title, then `ref · surface` beneath, with the wait pushed right in amber. Status is gone
from the row because status is what the filter above already selects, and progress moved into the
detail's eyebrow where it sits beside the status it qualifies.

**Proven says what the checks said**, from `ciStatus` — the same field the work page reads, so the two
screens cannot tell a founder different things about one piece of work. Five answers, and two of them
are silences told apart: *"the studio could not read this venture's checks"* is not the same as
*"no checks are recorded against this work"*, and neither is *"they passed"*.

### Two deviations, both stated rather than quietly absorbed

**R-08's exact wording cannot be built yet.** It asks for *"Unchanged since you last read it"* and
*"Changed since you last read it — re-read"*. The studio does not remember when a founder last read
anything. `headSha` is the commit at page render, and `acceptWork` compares it at accept time to
refuse work that moved underneath a decision — which is a different guarantee, made at a different
moment, and comparing it to itself on render would always say "unchanged".

A per-founder read record is a store the studio does not have. What it *can* prove today is what the
checks said, and that is the half of R-08 that was actually broken: a sentence printed for every
ticket regardless.

**Costs is FB-214.** A send's metered cost lives on the approval, not on the ticket row, and wiring it
through is its own change rather than a clause added to this one.
