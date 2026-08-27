# FB-139 — The office, live (gaps G6 and G7)

**Status:** Todo · **Area:** Venture box + studio · **Depends on:** FB-128
**Design:** `docs/design/foundry-desk/` — screen 3, "The office"; the plate beside the agent ledger.
**Gaps:** G6 and G7. The paper folds G7 into this ticket if the stream lands first.

## Why this matters (for the founder)

This is the design's answer to *why would anyone keep this open all day*, and it is the one piece with
no equivalent anywhere in the product today.

> Each character is 1 agent on Arca's machine; a raised hand is a wait on you.

Agents at desks while working, reading while researching, a hand up when they need the founder. Beside
it, the same events as a table. The design is explicit about why both: **"The office is the feeling;
this ledger is the record. Same events, so they cannot disagree."**

That constraint is the ticket. A pretty plate driven by different data from the table beside it would
be a lie with a nice picture on it.

## What is true today

Run reports per wake and heartbeats (`lib/runreports.ts`) — nothing live, nothing visual. The lane
writes a report when it finishes a wake; between wakes the studio knows nothing. `WhileWorking.tsx`
re-reads once a minute, only while something is in flight and visible, on FB-083's budget.

## Scope

- **A read-only state feed from the venture box**: lane state mapped to office scene. The studio
  consumes; it never writes. The box is the source of truth about its own agents.
- **The pixel-agents renderer, embedded read-only.**
- **One source for both renderings.** The plate and the ledger read the same feed. A test asserts they
  cannot disagree — that is the design's claim and it should be mechanical, not a promise.
- **G7, the live desk:** extend `WhileWorking`'s discipline to the desk's panels, or replace polling
  with this stream once it exists. The paper prefers the stream; the budget rule (FB-083: bounded per
  load, never repeating on a timer) still binds whichever is chosen.
- **Isolation holds.** One venture's box feeds one venture's desk (CLAUDE.md #6), enforced server-side.
- **A box that is not reporting says so.** The plate reads "not live" rather than freezing on the last
  scene, which would be the most convincing possible lie.

## Out of scope

- Writing to the box from the studio. Read-only, permanently.
- The placeholder plate — FB-124 ships that; this replaces it.

## Validation gates

```bash
npm run lint && npm run typecheck && npx vitest run
make design-lint && make ticket-drift
```

On the ARCA box before review — box-side work is never proven by CI (see `scripts/sync-box.sh` and
every entry in the box-install gotchas):

```
# start a lane wake; the plate moves and the ledger row changes together
# stop the lane;      the plate says "not live" rather than freezing
```

## Acceptance criteria

- [ ] The plate renders live agent state from the venture box, read-only.
- [ ] The plate and the ledger are driven by one feed, and a test asserts they cannot disagree.
- [ ] A raised hand corresponds to something genuinely waiting on the founder — the same count the
      blocker banner uses.
- [ ] A box that stops reporting shows "not live"; it never freezes on a stale scene.
- [ ] The desk's live behaviour respects FB-083's budget: bounded, and only while working and visible.
- [ ] One venture's feed can never reach another venture's desk, asserted server-side by a test.
- [ ] Proven on the ARCA box, both directions, before the PR is opened.
