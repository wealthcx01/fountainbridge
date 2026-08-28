# FB-152 — The desk and the rail state two figures for one budget

**Status:** Done · **Area:** Studio / desk · **Depends on:** FB-128

## What happens

On the same screen, two inches apart, with ARCA's real data:

- the rail reads **`sell £5,200/£4,800`**
- the desk's summary sentence reads **"£0 of £5,800 is spent this month"**

Both are correct and they contradict each other. `BudgetDisclosure` carries two figures:
`reportedMinor`, which is spend the venture reports as **committed**, and `queuedMinor`, which is
spend **proposed and awaiting the founder**. The rail totals both (`components/Rail.tsx:98`); the
desk's sentence, added in FB-128, states only the first.

Nothing has been spent — £0 is the honest answer to "spent" — and £5,200 is waiting on a decision
this founder has not made. A founder reading both learns that the studio disagrees with itself.

Found by running the desk against production data. The e2e fixtures have committed spend, so both
surfaces agreed there and neither the unit tests nor the UI gate could see it.

## Scope

- The summary names both: what is spent, and what is awaiting the founder's OK.
- The clause is only said when there is something waiting, so a venture with none reads no differently
  from before.

## Out of scope

- Changing what the rail shows. It has been right since FB-124.
- Any change to `lib/budgets.ts`. The two figures are correctly separated there; this is about a
  sentence that used one of them.

## Acceptance criteria

- [x] The desk's sentence states spend and queued spend, and cannot disagree with the rail's total.
- [x] A venture with nothing queued reads exactly as it did before.
- [x] Asserted by a test with a zero-spend, non-zero-queued venture — the shape production had and
      the fixtures did not.
