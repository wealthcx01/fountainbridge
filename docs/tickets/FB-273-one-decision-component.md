# FB-273 — One Decision component

**Status:** Done · **Kind:** small · **Budget:** $15 · **Rough date:** 31 October 2026 · **Pilot step:** 2 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

Accept and Send back are drawn three times today, in `components/WorkDetail.tsx`,
`components/TicketsView.tsx` and `components/TicketDrawer.tsx`. Each calls `acceptWork` and
`sendBackWork` and shares only `noteDecision` (`lib/decided.ts`). The Review screen (FB-274) and
the factory cards (FB-277) would make five copies. They must all behave the same.

## What to do

Make one component that draws the decision buttons and their messages, and use it in all three
places. `ApprovalCard.tsx` (approving a send) stays separate: it is a different decision.

## Done when

- [x] The three screens look and behave exactly as before, checked beside `main` at 1440×1000
  and 393×851, with heights recorded.
- [x] One test covers the component; the three screens' existing tests still pass.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

New buttons or new words.

## What shipped

`components/Decision.tsx` draws Accept and Send back for all three screens. Each screen picks its
`look` (`work`, `tickets` or `drawer`), which sets only its words, test ids and layout. Every press
goes through one function, `press`, which calls the server action, counts the decision
(`noteDecision`) and records which button it was (`decided: 'accept' | 'send-back'`).

All three screens were checked beside `main` at 1440×1000 and 393×851, as the founder and as John,
before and after each press: 64 pairs of pictures, all identical, all heights equal.

Two things found on the way:

- **The ticket drawer is not drawn by any page.** FB-178 removed it from the desk, and nothing has
  opened it since. It now uses the component like the other two, and was checked through a small
  harness. Deleting it would be a follow-up.
- **FB-281** (Send back says "accepted" on the work page) is kept as it was. The fix is now one
  line in `stateLabel` in `Decision.tsx`, which can read `result.decided`.
