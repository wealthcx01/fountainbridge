# FB-208 — the tickets screen against its design

**Status:** filed · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-06, R-07, R-08) ·
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

- [ ] No `.btn` in the filter row; the active tab is an underline and is still `role="tab"`.
- [ ] A ticket row on ARCA is one line at 1440px, and names its surface.
- [ ] Proven states a fact about *this* ticket, and changes wording when the head has moved.
- [ ] A send's Costs states the money, not "Nothing".
- [ ] Read at 1440×1000 and 393×851 on production, with the reading recorded in
      `docs/design-conformance.md`.
