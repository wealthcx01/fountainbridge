# FB-154 — Approvals are read whole, on every ticket click

**Status:** Todo · **Area:** Studio / performance · **Depends on:** FB-130

## What happens

The Tickets screen loads a ticket's trail when a founder selects it, and the trail needs the signed
approval events for **that ticket's** approvals. To know which approvals those are, it calls
`loadApprovals`, which walks every approval the venture has — roughly three content reads per
approval, sequential, and **not cached at all** (`lib/approvals.ts`).

Selecting a ticket is a server navigation, so this runs again on every click. `loadRunReports` is
bounded but is also new to this page, and FB-130 raised its limit from 20 to 200 because a trail asks
a different question from the desk.

FB-130's first version of that comment claimed "the only genuinely new reads are the signed events
for this ticket's approvals and the conversation it came out of". That was not true, and the review
caught it. The comment is honest now; the cost is not fixed.

## Why it matters

It is the shape `lib/trail-load.ts`'s own budget note forbids in as many words: *"A trail is opened on
one ticket, so its cost is a function of that ticket's own events — not of the venture's approvals."*
It is currently a function of the venture's approvals.

ETags make it cheap in quota. They do not make it fast, and latency is what a founder feels — the
same distinction FB-151 found on the rail.

## Scope

- An index from ticket to approval ids that does not require reading every approval. The approval
  files already carry `ticket`; what is missing is a way to ask the question without a walk.
- Measure before and after on production, the way FB-151's table does.

## Out of scope

- Caching `loadApprovals`. A TTL cache would hide the cost rather than remove it, and the desk reads
  the same data for a different reason — a stale approval queue is worse than a slow one.

## Acceptance criteria

- [ ] Selecting a ticket costs reads proportional to that ticket, not to the venture's approvals.
- [ ] Measured on production, three selections, before and after, recorded here.
- [ ] The desk's approval queue is unchanged in what it shows.
