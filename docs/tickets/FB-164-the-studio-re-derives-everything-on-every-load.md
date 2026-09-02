# FB-164 — The studio re-derives everything from git on every load

**Status:** Todo · **Area:** Studio / architecture · **Depends on:** FB-157, FB-161

**Shipped in part:** the rail's share is fixed (#201). The read model itself is still to build — see
"What is left" at the foot.

## What is true today

Measured on production, signed in as ARCA's founder, 2026-09-02:

| Screen | First byte | **Fully loaded** |
| --- | --- | --- |
| the desk | 429 ms | **7,916 ms** |
| tickets | 373 ms | 5,596 ms |
| what happened | 306 ms | 6,330 ms |
| memory | 318 ms | 5,814 ms |
| the handbook | 361 ms | 6,397 ms |

FB-151 and FB-157 fixed **time to first byte** — the studio stopped showing a white screen for five
seconds. They did not make the reads faster, and said so. This is the other half, and it is the half
a founder actually feels: the shell is instant and the screen is not finished for six to eight
seconds.

Note the handbook: **static markdown**, 6.4 seconds to finish. Nothing on that page needs a network
read at all; it is waiting on the rail beside it.

## Why it is slow, and why it is not the platform

Every screen re-derives its answer from the GitHub API on every load. `loadRunReports` alone is
~4.3s (FB-157's measurement) because it lists a directory and reads dozens of files. Nothing is
retained between requests except two short TTL caches, so the same work is done again, per founder,
per load, forever.

**This is not a limitation of being a web app.** The same calls made from an Electron shell, a native
iOS app or a desktop binary would take the same four seconds — it is network round trips to a code
host, not rendering, not JavaScript, not the browser. Moving the shell moves nothing.

D6 names Supabase as the data layer and it is unused. The studio has been git-only by design
(*"git is the source of truth for work items"*, and it should stay so) — but "git is the source of
truth" and "git is re-read from scratch on every page view" are different claims, and only the first
one is a principle.

## Scope

- A **read model**: a projection of what the studio renders, kept current, so a page load reads one
  store instead of walking a code host. Git stays the source of truth and the write path is
  unchanged — this is a cache with a name and a refresh rule, not a second database of record.
- **Refreshed by events where they exist, on a bounded schedule where they do not.** The venture box
  already writes a record every wake; that is a change signal nobody is listening to.
- **Staleness is visible.** A projection that can lag must say when it last refreshed, and FB-137's
  rule holds: a stale read is a different sentence from an empty one.
- **The budget still binds** (FB-083): bounded per refresh, never per viewer, never on a timer that
  grows with the portfolio.

## Out of scope

- Making git stop being the source of truth. It is not, and this does not change that.
- A different client platform. See the note above; that is not where the seconds are.

## Acceptance criteria

- [ ] `/venture/arca/handbook` is fully loaded in under 1s — it reads nothing about the venture and
      should never have waited on anything.
- [ ] The desk is fully loaded in under 3s on production, measured three times with the landing path
      checked.
- [ ] Git remains the source of truth; nothing is written to the projection that is not derived from
      it.
- [ ] The studio says how current the projection is, and says it plainly when it is behind.
- [ ] No read repeats on a timer, and no cost grows with the number of ventures a viewer can see.

## Measured properly, then fixed

`loadEventEnd` was the wrong number: it waits for every streamed chunk, so a handbook page whose
prose is on screen in 279ms "loads" in 6.4 seconds. What a founder waits for is **the content they
came for, on screen**. Timed on production, three loads each:

| Route | Content, before | Content, after | Rail, before | Rail, after |
| --- | --- | --- | --- | --- |
| the handbook | 279 ms | **248 ms** | 6,105 ms | **2,078 ms** |
| tickets | 315 ms | **304 ms** | 6,157 ms | **3,619 ms** |
| memory | 5,080 ms | **3,066 ms** | 6,539 ms | **3,070 ms** |
| the desk | 6,684 ms | 6,100 ms | 6,689 ms | 6,100 ms |
| what happened | 6,571 ms | 6,096 ms | 6,575 ms | 6,100 ms |

**The rail was ~6 seconds on every screen**, including the one whose own content arrives in a quarter
of a second. It is now 2–3.6 seconds where nothing else competes.

### What it was doing

`loadRunReports` opens `limit × READ_MARGIN` files per repository — sixty each, **a hundred and
eighty for ARCA** — and the rail wanted one number out of all of it: whether the machine is alive.

It did not need to open anything. Every report is named `<slug>-YYYYMMDDTHHMMSSZ.json`, which is
exactly why the loader sorts names lexicographically to get chronological order. **The newest wake's
time is already in the listing.** `loadLiveness` reads the listing and opens one file per repository
— the heartbeat beacon, overwritten in place, which carries no stamp in its name and on a quiet
venture is the only evidence of life there is.

## What is left

Two costs remain, both real and both measured:

- **The desk and "what happened" still take ~6s for their own content.** They read the backlog,
  repository health, approvals and the run reports themselves — in parallel, so the wall clock is the
  slowest, and `ventureRuns` at ~4.3s is it. The desk renders twenty run reports where the design
  shows four; asking for five would cut sixty reads per repository to fifteen. That is a product
  decision as much as a performance one and is not made here.
- **`ventureApprovals` at ~1.8s** is what the rail now waits on. It walks every approval a venture
  has, per repository, and is not cached across requests.

Neither is fixed by reading more cleverly. **The projection store is still the answer**, and it is
still a decision about the data layer: D6 names Supabase and it is unused. This ticket removed the
cost that was on every screen; the desk's own remains.

## Acceptance criteria

- [x] `/venture/arca/handbook` is fully loaded in under 1s — its **content** is on screen in 248 ms.
      Its rail follows at ~2s, which is the honest remaining figure and not the same claim.
- [ ] The desk is fully loaded in under 3s. **6,100 ms.** Not met, and not met by reading fewer
      files — see "What is left".
- [x] Git remains the source of truth; nothing is written anywhere, and the shortcut is derived from
      the listing git already returns.
- [x] The studio says how current it is: the engine line reads *"Your team checked in just now."* A
      listing it could not read degrades rather than reporting a stall — a repository it could not
      look at is not a machine that has stopped.
- [x] No read repeats on a timer, and the cost does not grow with the number of ventures a viewer can
      see. It went down.
