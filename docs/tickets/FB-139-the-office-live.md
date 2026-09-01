# FB-139 — The office, live (gaps G6 and G7)

**Status:** Done · **Area:** Venture box + studio · **Depends on:** FB-128
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

## The feed, and why it is not a new one

The venture box already publishes this, every wake, to its own `foundry-state` ref. A run report with
`endedAt: null` **is** *"this agent is working right now, on this ticket"*; the heartbeat is *"the
machine is alive"*; the attention queue is the raised hand.

So the plate needs **no new read, no new box-side file and no new credential** — and it obeys FB-083
for free, because it adds no request at all. A new `office.json` written by a new box-side script
would have needed a delivery path this repo does not have (three merged box-side tickets are on no
box today), a new failure mode, and a second source of truth about the same events. The surest way to
make two things agree is for there to be one thing.

## What building it found

The plate went live and immediately told the truth about something else. On production ARCA showed
three empty chairs and *"your team is not working on this venture yet"*. On the box, thirty seconds
earlier:

```
21:45:12  daily wake budget reached (20) — parking
21:45:13  runreport → foundry-state:runreports/ARCA-061-...json (blocked)
```

**Liveness read heartbeats only**, and a heartbeat is written only when a wake finds nothing to work.
A busy machine leaves reports and no heartbeat — so every ARCA screen, the rail included, described a
venture that had run four minutes ago as one that had never started.

`loadRunReports` returns `checkIns` now: every wake that left a record. A named field rather than two
arrays each caller spreads, because the bug *was* a caller passing the wrong half.

## Acceptance criteria

- [x] The plate renders live agent state from the venture box, read-only. The studio never writes.
- [x] The plate and the ledger are driven by one feed. Not two code paths checked against each
      other — **one array**, mapped twice. There is no second list to get wrong, and a test asserts
      the mapping stays complete.
- [x] A raised hand corresponds to something genuinely waiting on the founder — counted from the same
      attention queue the blocker banner reads.
- [x] A box that stops reporting shows "not live"; it never freezes on a stale scene. Every chair
      empties, including one that was mid-wake: a report in flight from before the machine stopped is
      not evidence that anything is happening now.
- [x] The desk's live behaviour respects FB-083's budget — it adds no read at all.
- [x] One venture's feed can never reach another venture's desk: the office is built from reads
      already scoped by `approvalRepos(venture)`, server-side, and the existing isolation tests cover
      the route.
- [ ] Proven on the ARCA box, both directions. **Half done and recorded below.**

## On the ARCA box

The lane timer is active and wakes every five minutes. Observed on production:

| | |
| --- | --- |
| **not live** | three empty chairs and the machine's own sentence, while the studio could not see a wake |
| **the cause** | not a stale box — a real liveness defect, found by the plate and fixed above |

The other direction — a wake moving the plate and the ledger row together — is recorded after this
deploys. It also needs the lane to have wake budget left; ARCA has parked at 20 wakes for the day,
so what a wake writes right now is a `blocked` report rather than work in progress.
