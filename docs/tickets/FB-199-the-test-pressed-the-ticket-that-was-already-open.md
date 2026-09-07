# FB-199 — the test pressed the ticket that was already open

**Status:** Done · **Phase:** 3 · **Found by:** FB-194's run, fixed on request 2026-09-07

## The fault

`e2e/tickets-view.spec.ts` failed about **one run in five**, on a required check, on unchanged code.
It pressed a ticket and the address never gained the `t=` that names it.

The cause is one sentence: **it pressed the ticket that was already open.**

This screen always has something open. With no `t=` in the address, `resolveSelected` falls back to
the first row of the current filter. The test chose the `settled` filter, which has exactly one
ticket, so the only row it could press was the one already showing. Pressing it asks to navigate to
what is on the screen already, and the address does not reliably change for that.

Pressing any row that was **not** already open passed 100 times out of 100.

## Three wrong fixes first, and each looked right

This took four attempts. The wrong three are worth writing down, because each was a reasonable
reading of the evidence and each was disproved only by running it a hundred times.

**Wait for the URL to say `filter=settled`.** Pressing a filter calls `router.replace`, which changes
the address before the new list arrives — so the test read a ticket off the previous filter's list.
True, a real race, and not the cause.

**Wait for `aria-selected` on the filter tab.** That attribute comes from the server's own HTML, so
it is already correct before React has attached anything to the page. It proves the page arrived,
not that it is listening. Still failed 4 in 100.

**Wait for the network to go quiet.** Still 2 in 100.

**And one piece of evidence was simply wrong.** I patched `history.pushState` to see whether the
click's handler ever ran, saw nothing, and concluded the click was being swallowed before hydration.
Next's router takes its own reference to `history.pushState` when it starts, long before a test can
wrap it — so the instrument could never have seen the call it was watching for. A whole afternoon's
theory rested on a measurement that was incapable of showing the thing it was measuring.

What settled it was the plainest experiment available: press the row **arriving by a direct link**,
with no filter press anywhere. It still lost 2 in 12. So nothing about the navigation was involved,
and the only thing left that was unusual about that row was that it was already open.

## The fix

The test now uses the `all` filter — which has several tickets — and presses one that is **not**
already open. The screen says which row that is: `aria-current="true"` marks the open one, so the
test asks for `li button:not([aria-current="true"])`.

It also checks the round trip properly at the end: reload the copied link and the same row comes
back marked as open.

The helper written for the third wrong fix is deleted rather than left lying about. It reached into
a React internal, it did not work, and a helper that does not work is worse than none — the next
person would have trusted it.

## Proof

| | |
|---|---|
| Before | ~1 failure in 5 |
| After | **10 rounds of the whole spec, 160 tests, no failures** |

Full suite: 280 Playwright passed, 1,547 unit tests, every gate clean.

## The thing that is not a defect

Pressing a ticket that is already open does not add it to the address. That reads like a bug and is
not one worth fixing: landing on `?filter=settled` opens the same ticket for everyone, so copying
that link and sending it shows the recipient exactly what the sender was looking at. The address is
already complete. Only the test cared.

## What this and FB-191 have in common

Both were tests that failed at random. Both had a plausible first explanation that was wrong. Both
were solved by running the thing a hundred times and reading what actually happened, not by reasoning
about what should happen.

FB-191's note said the twenty runs it asked for as proof turned out to be the diagnosis. That was
true again here, four times over.
