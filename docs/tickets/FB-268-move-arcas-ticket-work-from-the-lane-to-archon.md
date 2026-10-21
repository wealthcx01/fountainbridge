# FB-268 — Move ARCA's ticket work from the lane to Archon

**Status:** Blocked until FB-264 recommends it, and FB-266 and FB-267 are done · **Phase:** 3 ·
**Kind:** a medium change on ARCA's machine · **Raised by:** the October re-baseline (section 5,
ticket 6), filed 2026-10-21 at John's request · One ticket = one branch = one PR.

## Why

Two engines worked ARCA's tickets and collided (FB-264 lists how). The lane was paused on
7 October. If FB-264 recommends Archon, this ticket finishes the move, so only one engine works
ARCA from then on.

## What to do

1. **Stop the lane for good on ARCA's machine:** leave `foundry-lane.timer` disabled, and say so on
   the machine and in this repo.
2. **Keep everything else on ARCA's machine:** the brain, the office, the composer and the approval
   record (the D11 split, unchanged).
3. **Refresh the "How the Foundry works" pages** so they describe Archon working the tickets, in
   plain words.
4. **Mark the lane scripts retired** (`deploy/lane/`): a note at the top of each folder saying what
   replaced it and when. Don't delete them in this ticket.
5. **Where Archon runs for ARCA:** follow FB-264's answer (the planning box, Cowgate's Railway
   runners, or ARCA's own machine as a stopgap).

## Acceptance

- [ ] The lane timer is off and documented as retired; nothing on ARCA's machine starts it again
      after a reboot.
- [ ] One ARCA ticket runs end to end through Archon, approved from the studio (FB-267).
- [ ] The "How the Foundry works" pages are updated and looked at, at both sizes.

## Out of scope

- Deleting the lane scripts. That is a later clean-up, once Archon has run ARCA for a month.
- Other ventures. ARCA is the only real venture today.
