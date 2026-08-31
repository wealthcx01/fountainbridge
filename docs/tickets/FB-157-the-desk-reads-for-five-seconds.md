# FB-157 — The desk does its own five seconds

**Status:** Todo · **Area:** Studio / performance · **Depends on:** FB-151

## What was measured

FB-151 took the rail off the critical path and every screen under a venture dropped with it — except
two, which turned out to have been paying for their own reads all along, invisibly, behind the
rail's five seconds. Production, signed in as ARCA's founder, three loads each, median TTFB:

| Route | Before FB-151 | After | What is left |
| --- | --- | --- | --- |
| `/venture/arca/handbook` | 5,333 ms | **219 ms** | nothing — it reads nothing |
| `/venture/arca/tickets` | 5,242 ms | **243 ms** | nothing — FB-155 already streamed its trail |
| `/venture/arca/knowledge` | 5,238 ms | **3,483 ms** | the corpus and its provenance |
| `/venture/arca` | 5,190 ms | **4,858 ms** | the desk's own panels |

## Why this matters (for the founder)

The desk is the screen a founder opens first and returns to all day. Five seconds of white is what
the studio feels like to them, whatever the rest of it does. FB-128 set the target of **under three
seconds** and it is still not met — it was never met, and the reason it looked close is that the
measurement subtracted one rail-bound number from another.

## What is already known

- **The desk.** FB-128 parallelised its reads and left them all blocking. Nothing above the fold
  needs any of them: the desk's header, prompt bar and section headings are chrome.
- **Memory.** FB-133 added one aliased provenance query per surface on top of the two corpus reads,
  plus the routines. Bounded per load and capped at 60 paths, so it obeys FB-083 — but bounded is
  not fast, and the routines half is a listing plus one read per routine.
- **The instrument exists.** `lib/timing.ts` records real requests; `/admin/timing` prints the
  medians. **Measure before changing anything.** This ticket exists because two rounds of
  optimisation were aimed by reasoning and the third was aimed by a reading that had not checked
  which page it landed on.

## Scope

- Read `/admin/timing` after real use and record which reads the two screens are waiting on.
- Take what is not needed above the fold off the critical path, the FB-155 / FB-151 way: the shell
  renders, each panel arrives when it has something to say.
- Every not-yet-known state says so. No zero, no "not set", no empty list standing in for a read
  that has not finished (FB-151's `railWords` is the pattern).

## Out of scope

- Reducing the number of reads. That is a different question and FB-083's budget already governs it;
  this ticket is about what a founder waits for, not what the studio asks for.

## Acceptance criteria

- [ ] The reads behind the desk and Memory are measured on production and recorded here.
- [ ] `/venture/arca` is **under 3s**, which has been FB-128's unmet criterion since.
- [ ] `/venture/arca/knowledge` is under 1s.
- [ ] Nothing renders a value it does not have yet; each waiting panel says what it is waiting for.
- [ ] Measured three times on production, landing path checked beside every reading, and recorded.
