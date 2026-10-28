# FB-266 — Archon's runs show on the desk

**Status:** Replaced by FB-277 (the factory pilot, 28 October 2026) · **Phase:** 3 · **Kind:**
a medium build · **Raised by:** the October re-baseline (section 5, ticket 4), filed 2026-10-21 at
John's request · One ticket = one branch = one PR.

## Why

The office and "What happened" show what the studio's own lane is doing, read from the venture
box's `foundry-state` ref (`lib/office.ts`). When Archon works a venture's ticket, the founder sees
nothing until the work is merged. If FB-264 says Archon should work venture tickets, the desk must
say "your team is working on ARCA-077 now" whichever engine is doing it.

## What to build

1. **Read Archon's runs for a venture's repositories.** Two sources exist: Archon's API on the
   planning box (behind its login), and the factory's `factory-log` events (`ticket.started`,
   `pr.opened`, and so on). Pick one in the plan and say why. The studio reads; it never writes.
2. **Show them in the office and in "What happened"** as the lane's runs are shown today: "Your
   team is working on ARCA-077", "ARCA-077 is waiting for your approval of its plan", "ARCA-077 is
   ready for review". Plain words only; no run ids or step names on screen.
3. **Venture isolation, checked on the server** (non-negotiable 6). A founder sees runs for their
   own venture's repositories only. The filter runs on the server, from the venture's manifest.
4. **A cross-venture test that must fail to read:** signed in as ARCA's founder, ask for another
   venture's runs and get nothing (the FB-170 pattern).

## Acceptance

- [ ] An Archon run on an ARCA repository shows in ARCA's office and "What happened" while it runs.
- [ ] The cross-venture test passes: another venture's runs never reach ARCA's founder.
- [ ] If Archon can't be reached, the desk says so in one plain line, not an empty office
      (non-negotiable 10).
- [ ] Screens looked at, beside the design, at both sizes (non-negotiable 11).

## Out of scope

- Approving a plan from the studio (FB-267).
- Moving ARCA's work from the lane to Archon (FB-268).
