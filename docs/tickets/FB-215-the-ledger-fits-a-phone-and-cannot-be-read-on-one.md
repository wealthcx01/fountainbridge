# FB-215 — the ledger fits a phone, and cannot be read on one

**Status:** filed · **Phase:** 3 · **Found by:** FB-211's screenshot, 2026-09-09

## What is on the screen

The admin ledger at 393×851. Every column is squeezed until the words break one letter at a time:

```
ARCA                Moder
Spen                nisatio
ding                n
has                 Engine
passe
d the
limit
```

"Modernisation Engine" takes four lines. "Spending has passed the limit this venture set" takes
fourteen. The engine column does the same. A row is about 300px tall and says almost nothing.

## Why the test did not catch it

`e2e/ledger.spec.ts` has a test called **"it fits a phone"**, and it passes. Its comment is honest
about what it is checking — *"Seven columns on a 393px screen is FB-153 waiting to happen"* — and it
asserts the page does not scroll sideways.

It does not. The page achieves that by wrapping every cell until it is a column of single letters.
**Fitting and being readable are different things**, and the test only knows about the first.

This is the same shape as the faults CLAUDE.md rule 11 exists for: a green check over a screen nobody
had looked at. It was found by taking a screenshot for a different ticket.

## Who this affects

Only Bruntsfield — the ledger is admin-only, and a founder never sees it. That is why it is filed
rather than fixed on the spot. It is still the screen John opens to see every venture at once, and
he opens it on a phone like everything else.

## Scope

- Below a threshold, stop being a table. The rows already carry a state mark and a sentence
  (`rowTone` / `rowReason`) — on a narrow screen those two plus the venture's name are the whole
  useful content, and the counts can sit under them.
- The desk already solves this. `.table-scroll` and the pocket layout are the existing patterns; do
  not invent a third.
- **Change the test so it can tell the difference.** "Fits" must mean readable: assert a minimum
  column width, or a maximum row height, or that no cell wraps below some number of characters per
  line. A test that passes over this screenshot is not testing what its name says.

## Acceptance criteria

- [ ] At 393px the ledger is readable: no cell wraps mid-word into a single-letter column.
- [ ] Still no sideways scrolling.
- [ ] The test fails against the current layout and passes against the new one.
- [ ] A screenshot at 393px is in the PR, and it has been looked at (rule 11).
