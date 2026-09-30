# FB-178 — the desk renders the entire backlog, and is five times longer than its design

**Status:** Done · **Phase:** 3 · **Found by:** the design comparison, 2026-09-02

> **Done:** the ticket board is off the desk, runs are collapsed and cut to the design's four, and a
> height ratchet guards it — now measured over a venture the size ARCA actually is.
>
> **The reading, 2026-09-30.** The desk over **73 tickets and 1,773 run reports** is **2,230px at
> 1440x1000** and **2,721px at 393x851**. The same desk over the gate's six tickets and six run
> reports is **2,165px**. Sixty-five pixels separate a venture's first week from its 1,773rd run
> report.
>
> **The reading on ARCA's real data, taken 2026-09-30.** Signed in as ARCA's founder, over the
> venture's own 73 tickets and **9,889 run reports**: **1,689px at 1440x1000** and **2,175px at
> 393x851**. That is below the design's own ~1,900px. Nothing on the screen reported a failed read,
> and neither viewport scrolls sideways.

## Measured, both sides, 1440×1000

The design artifact and `https://foundry-studio-production-4a73.up.railway.app/venture/arca`,
rendered at the same viewport and measured:

| | design | live |
| --- | --- | --- |
| **whole page** | ~1,900px | **9,908px** |
| desk summary | ~100px | 52px |
| prompt bar | ~70px | 71px ✓ |
| the office | ~330px | 369px ✓ |
| what the engine did | ~330px (4 runs) | **2,621px (20 runs)** |
| waiting on you | ~230px (3) | 310px (6) |
| the company, by surface | ~140px | 505px |
| **a kanban board of every ticket** | **not in the design** | **4,634px** |

## The two things that account for it

**1. A 73-ticket kanban board, on the desk.** `lane-arca` renders "Build — Product · 73 tickets" as
four columns — TO DO 20, IN PROGRESS 14, NEEDS YOUR OK 3, **DONE 37** — occupying 4,634px, nearly
half the page. The design's desk contains no ticket board at all: it has *Waiting on you* (three
rows, the things that block the founder) and *The company, by surface* (three summary cards), and
the board lives on the Tickets screen, which is what the rail's "Tickets" row is for.

Thirty-seven **done** tickets are the clearest symptom. The desk's stated job is *what is happening,
what waits on me, what my team did, is any of it working.* Finished work is none of those.

**2. Twenty run rows where the design shows four.** The design's line is explicit: *"Showing the 4
most recent of 31 runs."* Ours shows 20, each ~131px against the design's ~48px, and on ARCA most of
them are the same sentence — "Stopped on ARCA-061… Daily plan: team budget reached — parked until
tomorrow" — repeated as the lane re-parks every five minutes.

## Why this is the answer to "the design still seems off"

Every screen exists and the components are close in isolation — the prompt bar is within 1px, the
office within 40px. What is wrong is **what the desk chooses to show**. A founder opening it meets a
ten-thousand-pixel scroll whose middle two-thirds is finished work and a repeated status line. The
design is a page you read in one screen and act on.

No test could have caught it. Every section renders, in the right order (`desk.spec.ts` asserts
exactly that), with correct data. The page is *right and unusable* — which is the same family as
FB-124 and FB-161, and the reason FB-175 exists.

## Scope

- Take the ticket board off the desk. The rail's Tickets row is its home.
- If a summary belongs on the desk, it is a count and a link — the design's "14 tickets · preview of
  the app running from the venture VM", which is already what `dept-surfaces` does.
- Show four runs, not twenty, with the design's own "showing N of M" line and a link to
  *What happened* for the rest. `limit` is a caller's argument; the desk's is not the activity page's.
- Collapse consecutive identical run rows into one with a count. Fifteen copies of "parked until
  tomorrow" is one fact.
- **Assert the page's height**, at both viewports. A desk that grows without bound as a venture ages
  is the defect, and only a measurement catches it.

## What "a real backlog" needed, and why the old fixture could not give it

The last criterion is the one that took the work, and the reason is worth keeping.

The gate's ARCA fixture holds **six tickets and six run reports**. Every list on this desk is capped.
**A cap of four over six items renders exactly the same screen as no cap at all over six items** — so
the fixture the height was being measured against could not tell a bounded desk from the 9,908px one
this ticket was raised for. The measurement was real and it was answering a question nobody asked.

So `scripts/make-scale-fixture.mjs` builds a venture at ARCA's real numbers — 73 tickets, 1,773 run
reports, 20 open pull requests — and `e2e/desk-at-scale.spec.ts` measures the desk over it, on its
own server, in its own CI step. The fixture is generated rather than committed: 1,773 run reports is
1,773 files, and a fixture larger than the application does not belong in the repository's history.

**The first version of that fixture was useless and passed anyway.** It parked on one ticket
nineteen times in twenty, which is close to what ARCA's tail really looked like — and `collapseRepeats`
merges consecutive identical runs, so sixty reports collapsed to about three rows. Raising the run
cap from four back to twenty, which is this ticket's original defect, then changed the page height by
almost nothing and the ratchet stayed green. It was found by trying to break it. The fixture now
carries both distinct work and clusters of the repeated park, and the same mutation takes the desk to
**2,795px** and fails.

## The reading on real data, and the blocker that was never real

This ticket sat for weeks with its first criterion unticked, recorded as blocked on "a signed-in
session on production that the lane does not have". **That blocker did not exist**, and John said so:
there were already GitHub tokens for foundry and arca.

He was right, and the reasoning is worth keeping because it generalises. **Git is the source of truth
for work items.** The studio is a view over the venture repos' `docs/tickets/` through the GitHub
API, with no separate database of record. So a local build pointed at a real `GITHUB_TOKEN` reads
*exactly* the data production reads. The production deployment adds a hostname, not a fact.

And the token was already on the machine. `gh auth token` has had `repo` scope on `wealthcx01/arca`
the whole time. What was recorded as an external blocker was a thing nobody had looked for.

### What was measured

Signed in as **ARCA's founder** — the view CLAUDE.md #11 asks for, because an admin sees banners a
founder never does and they add height.

| the desk, on ARCA's own data | 1440×1000 | 393×851 |
| --- | --- | --- |
| as the founder | **1,689px** | **2,175px** |
| as a Bruntsfield admin | 1,825px | 2,465px |

Over **73 tickets and 9,889 run reports** — the run history has grown more than fivefold since the
1,773 recorded at the top of this ticket, and the desk did not grow with it. Neither viewport scrolls
sideways. Nothing on the screen said anything could not be read, so these are not the heights of a
degraded page.

Both screens were rendered and looked at as pictures, not as markup.

`scripts/measure-on-real-data.mjs` takes the reading again, so this capability cannot be mislaid a
second time. It is not a gate and never runs in CI: it reaches the live GitHub API, and a gate that
needs the network fails when GitHub has a bad morning.

### What is still not the production deployment

These readings are of a local build of this commit, reading production's data. They are not taken
against `foundry-studio-production-4a73.up.railway.app` itself. The data is identical; what a reading
on that host would additionally prove is that its own environment renders the same — which is a
deployment question rather than a question about this ticket.

## Acceptance criteria

- [x] The desk is under 3,000px on ARCA's production data at 1440×1000. **1,689px**, signed in as
      ARCA's founder over its own 73 tickets and 9,889 run reports. 2,175px on a phone.
- [x] No finished ticket is rendered on the desk. Asserted over a backlog that is half finished work,
      the same proportion production had (37 of 73).
- [x] Four runs, with an accurate "showing N of M" and a link to the rest. *"Showing the 4 most recent
      of 1,773 runs · What happened"*.
- [x] Consecutive identical runs are one row with a count — *"the same thing 4 times"*.
- [x] A test fails if the desk exceeds a stated height, and it is measured against a venture with a
      real backlog rather than a fixture with three tickets. `e2e/desk-at-scale.spec.ts`, 73 tickets
      and 1,773 run reports, at both viewports, in CI.

## Found while doing this

**FB-240** — the rail and the desk read two different clocks, so every gate screenshot shows the rail
saying the machine is dead while the body says it checked in ten minutes ago. Production is not
affected. Found by looking at the picture after the numbers were already right.
