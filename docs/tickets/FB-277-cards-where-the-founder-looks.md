# FB-277 — Factory cards in "Needs you" and "What happened"

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 6 November 2026 · **Pilot step:** 6 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.
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

- [ ] Journey 3 in `harness/END-TO-END.md` passes against a test copy.
- [ ] Every changed screen is looked at beside its design at 1440×1000 and 393×851, with heights
  recorded.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.
