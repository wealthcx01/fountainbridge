# FB-277 — Factory cards in "Needs you" and "What happened"

**Status:** Done · **Kind:** medium · **Budget:** $25 · **Rough date:** 6 November 2026 · **Pilot step:** 6 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.
Replaces FB-266.

## Why

A founder shouldn't have to go somewhere new to see the factory's work. It belongs where they
already look.

## What to do

- Finished, stuck and sent-back cards appear in the desk's "Needs you" list
  (`components/VentureBoard.tsx`), the Tickets screen's "Needs you" filter
  (`components/TicketsView.tsx`, `lib/tickets-view.ts`), and "What happened"
  (`components/ActivityFeed.tsx`).
- Each card's look comes from the "Studios, aligned" canvas. A finished card opens the Review screen.
- The desk's layout doesn't change.

## Done when

- [x] Journey 3 in `harness/END-TO-END.md` passes against a test copy (`e2e/factory-cards.spec.ts`,
  with journey 6's "in their lists").
- [x] Every changed screen is looked at beside its design at 1440×1000 and 393×851, with heights
  recorded (`docs/design-conformance.md`, FB-277).
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## What shipped

- **Cards are rows of the lists that already exist.** The desk's "Waiting on you", the Tickets
  screen's "Needs you" filter, the rail's count, and "What happened". No new section, and the desk's
  layout is unchanged. A finished card's row opens its Review screen. A stuck card is also named on
  the desk's stuck line. The rules are in one place, `lib/factory-work.ts`; the reads in
  `lib/factory-work-load.ts`.
- **Where a card stands** comes from the box's state and the presses on it, read with the Review
  screen's own `stateFrom`. Finished, stuck and sent-back cards wait on whoever looks at the venture.
  A card a founder has signed off waits on John alone. A card John approved and the box answered
  done is in "What happened", not in "Needs you".
- **One piece of work, one row.** A pull request read from GitHub and a card are the same work when
  they share a repository and number, or a ticket in the same repository. The card's row is shown
  and counted; the pull request is not, wherever it is listed and whatever the card's state.
- **Founders read plain parts only.** Every row and line is built on the server, through
  `founderSafe`, with no cost and no next step. John's rows add `forJohn.cost`, and on Tickets and
  `/attention` also `forJohn.nextStep`.
- **The factory's own cards.** The door now keeps cowgate's cards under `_factory`, a venture id no
  manifest can have (`loadVentures` skips any id starting with `_`). Only John sees them, on
  `/attention` while one waits and on `/activity`. They have no Review screen in the studio.

## Two things this ticket settled

- **What "Needs you" counts depends on who is looking.** A founder's sign-off is theirs done: the
  card then waits on John, so it leaves the founder's count and joins John's. The rail, the desk's
  sentence, Tickets and the header all use the same rule, so they still say one number.
- **The desk still shows at most four rows.** Sends come first, then the factory's cards, then the
  work read from GitHub. On a venture with many sends, only the oldest card may fit; "Needs you"
  has the rest, and the stuck line names any stuck one.
