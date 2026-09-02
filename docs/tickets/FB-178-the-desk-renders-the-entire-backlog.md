# FB-178 — the desk renders the entire backlog, and is five times longer than its design

**Status:** Shipped in part · **Phase:** 3 · **Found by:** the design comparison, 2026-09-02

> **Done:** the ticket board is off the desk, runs are collapsed and cut to the design's four, and a
> height ratchet guards it. The named sections now total **1,892px** against the design's ~1,900 —
> the shape is right.
>
> **Left, deliberately:** the page is 4,157px in the gate's fixture, and the gap above the named
> sections is `approvals-queue` (739px) and `approvals-decided` (356px). "Decided — what happened
> next" is finished work on a desk whose design has no such section, which is the same argument as
> the DONE column — but it is FB-142's external-send record, genuinely the founder's business, and
> removing it is a product decision rather than a conformance fix. Next candidate; not taken here.

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

## Acceptance criteria

- [ ] The desk is under 3,000px on ARCA's production data at 1440×1000.
- [ ] No finished ticket is rendered on the desk.
- [ ] Four runs, with an accurate "showing N of M" and a link to the rest.
- [ ] Consecutive identical runs are one row with a count.
- [ ] A test fails if the desk exceeds a stated height, and it is measured against a venture with a
      real backlog rather than a fixture with three tickets.
