# FB-157 — The desk does its own five seconds

**Status:** Done · **Area:** Studio / performance · **Depends on:** FB-151

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

## What the instrument said

Measured against **production data**, signed in as ARCA's founder — the studio run locally with the
service's own environment, so these are the real reads:

| Step | Median |
| --- | --- |
| `desk: what your team did` | **4,268 ms** |
| `desk: repository health` | 3,460 ms |
| `desk: your backlog` | 2,097 ms |
| `memory: recurring work` | 2,024 ms |
| `desk: your approvals` | 1,828 ms |
| `memory: the documents` | 790 ms |
| `memory: where each came from` | 569 ms |
| `desk: open work` | 6 ms |
| `desk: the record behind each approval` | 0 ms |

They run in parallel, so the wall clock is the slowest, not the sum. **`loadRunReports` is the most
expensive read in the studio**, and it is what the rail was waiting on too — which answers FB-151's
open question as a side effect.

### And a duplicate nobody had counted

    desk: what your team did   4,447 ms
    rail: what your team did   3,300 ms
    desk: your approvals       1,712 ms
    rail: your approvals       1,707 ms

Those are not four reads. They are two, done twice — once by `app/venture/[id]/layout.tsx` for the
rail and once by the page inside it, because a layout and its page render independently and each
built its own source. Every screen under a venture was paying for both, and with
`GITHUB_MAX_CONCURRENT` at 8 the duplicates did not run beside the originals, they queued against
them. Deduping alone took the desk from 4.7s to 2.7s warm.

## After the fix

| | Before | After |
| --- | --- | --- |
| `/venture/arca` | 5,190 ms | **58–119 ms** |
| `/venture/arca/knowledge` | 5,238 ms | **46–87 ms** |

Time to first byte. The reads themselves have not got faster — `loadRunReports` still takes ~4.3s,
and the board still fills in when it does. What changed is that a founder is no longer looking at
white while it happens.

**Reducing that 4.3s is a separate question**, and this ticket said so from the start: it is about
what a founder waits for, not what the studio asks for. `loadRunReports` reads `limit × READ_MARGIN`
files per surface, and the rail needs only the heartbeat out of all of it.

## Acceptance criteria

- [x] The reads behind the desk and Memory are measured and recorded here.
- [x] `/venture/arca` is **under 3s** — 58–119 ms. FB-128's criterion, met at last, and by the
      opposite of what FB-128 tried.
- [x] `/venture/arca/knowledge` is under 1s — 46–87 ms.
- [x] Nothing renders a value it does not have yet. The waiting shells carry a name and a line, and
      **no controls at all** — see below.
- [x] Measured on production after the deploy, landing path checked beside every reading.

### On production

Signed in as ARCA's founder, three loads each, landing path checked, median TTFB:

| Route | Before FB-151 | After FB-151 | After this |
| --- | --- | --- | --- |
| `/venture/arca` | 5,190 ms | 4,858 ms | **231 ms** |
| `/venture/arca/knowledge` | 5,238 ms | 3,483 ms | **230 ms** |
| `/venture/arca/tickets` | 5,242 ms | 243 ms | 227 ms |
| `/venture/arca/handbook` | 5,333 ms | 219 ms | 230 ms |
| `/venture/arca/activity` | — | — | **5,986 ms** ← not touched by this ticket |

And the screens still finish: the desk's summary reads *"6 decisions wait on you; your team is on 14
moving tickets…"*, Memory's reads *"11 documents — 8 pieces of background, 3 artifacts"*, and there
is exactly **one** prompt bar and **one** Add control on each, with no waiting shell left behind.

**`/venture/arca/activity` is the one screen still at six seconds.** It reads health, runs and
approvals directly and was not in this ticket's scope. Filed as **FB-158**.

## A control in a Suspense fallback is a dead control

The first version put the desk's prompt bar and Memory's Add form in the waiting shells, reasoning
that a founder could start typing before the board finished. **They could not.** A fallback is not
hydrated, so the controls did nothing — and while the boundary resolved, both copies were in the
document at once, which the UI gate caught as two elements answering to one test id.

Present and inert is the dead control the design contract forbids, with a plausible excuse. The
shells now carry no controls, and the gate asserts there is exactly one of each on the real screen.
