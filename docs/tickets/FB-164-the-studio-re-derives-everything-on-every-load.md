# FB-164 — The studio re-derives everything from git on every load

**Status:** Todo · **Area:** Studio / architecture · **Depends on:** FB-157, FB-161

**Shipped in part:** nothing of this ticket has shipped. The commit that names it (#196) filed the
ticket and recorded the measurements in it. The read model is still to build.

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
