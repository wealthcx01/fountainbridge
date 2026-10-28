# FB-273 — One Decision component

**Status:** Todo · **Kind:** small · **Budget:** $15 · **Rough date:** 31 October 2026 · **Pilot step:** 2 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

Accept and Send back are drawn three times today, in `components/WorkDetail.tsx`,
`components/TicketsView.tsx` and `components/TicketDrawer.tsx`. Each calls `acceptWork` and
`sendBackWork` and shares only `noteDecision` (`lib/decided.ts`). The Review screen (FB-274) and
the factory cards (FB-277) would make five copies. They must all behave the same.

## What to do

Make one component that draws the decision buttons and their messages, and use it in all three
places. `ApprovalCard.tsx` (approving a send) stays separate: it is a different decision.

## Done when

- [ ] The three screens look and behave exactly as before, checked beside `main` at 1440×1000
  and 393×851, with heights recorded.
- [ ] One test covers the component; the three screens' existing tests still pass.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

New buttons or new words.
