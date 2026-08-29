# FB-155 — The tickets screen took 23 seconds

**Status:** Done · **Area:** Studio / tickets · **Depends on:** FB-130

## What happened

FB-130 put the trail on the ticket and blocked the page on it. Measured on production, signed in as
ARCA's founder, against the real backlog:

| Screen | Before FB-130 | After |
| --- | --- | --- |
| the desk | 6.5s | 6.5s |
| tickets | ~7s | **23.1s** |
| tickets, a ticket selected | — | 22.6s |
| tickets, no selection at all | — | 22.9s |

Twenty-three seconds is not a slow screen; it is a screen a founder closes. And it was the same with
**no selection**, because FB-130's own review fix made the selection always resolve to the first row
— so the trail always loaded.

## Where it went

Two reads, both added by FB-130, both on the critical path:

- **`loadRunReports(venture, source, 200)`.** The 200 was there to stop run hops vanishing for older
  tickets. `loadRunReports` reads `limit × READ_MARGIN` files — so 200 became **600 file reads per
  repository**, three repositories deep. That is most of the sixteen seconds.
- **`loadApprovals`**, which walks every approval the venture has and is not cached, to learn which
  approvals belong to this one ticket.

The review flagged the second as a finding on FB-130. It was answered with a ticket (FB-154) rather
than a fix, on a page that was already paying it. That was the wrong call: filing a ticket for a cost
you are in the middle of introducing is not the same as not introducing it.

## What changed

**The trail streams.** It is its own async server component behind `<Suspense>`, so the list and the
ticket paint immediately and the history arrives behind them. A founder came to this screen to read a
ticket and decide on it, and neither of those needs the history — which makes the trail exactly the
thing that should not block.

**The run limit is back to the default 20, and the cap is spoken.** When there were more reports than
were read, the trail sets `degraded` — whose copy already says the right thing: *"it is not that
nothing else happened, it is that the studio could not see it."* Reading everything to avoid a
truncated history was the wrong trade; saying the history is short is the right one.

FB-154 still stands for the approvals walk, which is now off the critical path but not cheap.

## Acceptance criteria

- [x] The tickets screen paints without waiting for a ticket's history.
- [x] A pending state says what is happening rather than leaving a gap that later grows a section.
- [x] A truncated history says it may be short rather than passing as complete.
- [ ] Measured on production, three loads, and recorded here. — *after this deploys.*
