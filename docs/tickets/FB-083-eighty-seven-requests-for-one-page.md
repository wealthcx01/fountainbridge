# FB-083 — Eighty-seven requests to draw one page

**Status:** Done · **Phase:** 2 · **Depends on:** FB-077 (which measured this and did not fix it) ·
**Repo:** fountainbridge · **Branch:** `fb-083-eighty-seven-requests-for-one-page` ·
One ticket = one branch = one PR.

## Why this matters (for the founder)
Nothing is visibly wrong today. This is about the ceiling.

Opening one venture board asks GitHub eighty-seven separate questions. FB-077 made most of those
questions free most of the time, which is why the studio works. It did not reduce how many there
are — so the studio still has a hard limit on how much it can be used, and that limit arrives without
warning as pages that quietly stop showing your work.

## What FB-077 established
Measured against the live ARCA board, three consecutive renders:

```
1st render (cold)   sent= 86  free304=  0  coalesced= 5  PAID= 86
2nd render (warm)   sent= 87  free304= 59  coalesced= 4  PAID= 28
3rd render (warm)   sent= 86  free304= 59  coalesced= 5  PAID= 27
```

Conditional requests took the *paid* cost from 86 to 28 — a 68% cut. The App's budget is 5,000 an
hour, so warm that is roughly **178 board views an hour**, and cold — after every deploy, when the
cache is empty — roughly **58**.

Fifty-eight is not a lot. One founder pressing refresh while a colleague opens the attention queue,
on the morning after a deploy, is inside that number.

### Where the eighty-seven go
```
  7  /repos/*/pulls                    5  /repos/*/commits/*/status
  5  /repos/*/commits/*/check-runs     3  /repos/*/actions/runs
  3  /repos/*                          3  /repos/*/commits
  2  /repos/*/branches/main/protection
```
…and **the remainder is one request per ticket file.** That is the bulk of the eighty-seven, and it
is the part this ticket is really about.

## Why it is one request per ticket
The studio reads `docs/tickets/` through the REST contents API: one call to list the directory, then
one call per file to get its bytes. A venture with forty tickets costs forty-one requests to draw a
board, every time, per repository.

That is the correct way to use that API and the wrong API to be using.

## The approach to weigh
**GraphQL is the obvious candidate, and it has a property that matters more than its shape**: it
draws on a **separate 5,000-point budget** which the studio does not touch at all. Measured on
2026-08-01, the graphql budget was `{ limit: 5000, used: 0 }` — an entire second allowance, unused.

A single GraphQL query can fetch many files by path in one round trip. Forty-one requests becomes
one. And because it is a different pool, it does not compete with the REST reads the studio still
needs for pull requests and checks.

The honest counterweights, which the ticket should record rather than skip:

- **GraphQL costs points, not requests**, and the formula is not one-per-file. A query that fetches
  forty blobs is cheap; one that walks a repository tree is not. This must be *measured* the way
  FB-077 measured REST, not assumed.
- **It is a second API surface** — a second client, a second error vocabulary, a second thing that
  can break in a way the first does not. `lib/github.ts` is well understood; this adds a sibling.
- **The tests currently inject a REST fetcher.** Every read model takes its source as a seam, so this
  should slot in — but if it does not, the fix is not to loosen the seams.
- **ETags still apply.** A warm REST render already pays 28. If GraphQL turns out to be no cheaper
  than 28 warm, the only real gain is the cold case — which is the one that matters after a deploy,
  but it is a smaller prize than it first looks.

An alternative worth pricing before committing: **fetch the tickets directory as one tree** via
`GET /repos/{o}/{r}/git/trees/{sha}?recursive=1`, then fetch only the blobs whose sha changed since
the last render. That stays on REST, needs no second client, and turns "one request per ticket" into
"one request per *changed* ticket" — which on a normal day is zero.

## Scope
- **Measure both candidates** against the real ARCA board, with the counter FB-077 added, and record
  the numbers in this ticket. Cold and warm, requests and — for GraphQL — points.
- **Pick one, and write down why**, including what was given up.
- **Keep the seams.** Every read model takes its source injected; whatever lands must too, or the UI
  gate stops being able to run offline.
- **Report the budget honestly when it runs low.** FB-077 added `githubBlockedUntil`; nothing shows
  it to anyone yet. An operator should be able to see how close the studio is to its ceiling before
  a founder does.

## Out of scope
- Moving away from git as the source of truth. The architecture is not the problem; the read
  pattern is.
- Caching venture data in a database. That is a different design with different failure modes, and
  it deserves its own argument rather than arriving as a performance fix.

## Both candidates, measured against the live ARCA repository
As the ticket demanded, before writing anything:

| | Result |
| --- | --- |
| **Git trees** | 1 request → 49 ticket paths **with blob shas**, `truncated: false`, 603ms. Blob shas are content-addressed, so a cached blob never needs revalidating. But the blobs themselves are still one request each on first sight. |
| **GraphQL** | 1 request → the default branch, all 49 filenames **and all 49 file texts**, 1134ms, **cost: 1 point of 5,000** — from a budget the studio was not touching at all (`used: 0`). |

GraphQL won on the measurement that mattered: one query replaces the repository call, the directory
listing and 49 file reads — 51 REST requests for one.

## And then the numbers said something I did not expect
| | Before | After |
| --- | --- | --- |
| Total requests, cold | 86 | **53** |
| Total requests, warm | 87 | **50** |
| **Paid** (counting against the budget), cold | 86 | **53** |
| **Paid, warm** | 28 | **48 — worse** |

Total round trips fell by more than a third, which is real: the page is doing less work and returns
sooner. But the **paid warm cost nearly doubled**, and that is the number that decides how many times
a founder can open their board in an hour.

The cause is structural and I should have seen it before building: **a GraphQL query is a POST, and a
POST cannot be answered with a free `304`.** FB-077's whole saving came from conditional requests, and
49 ticket reads that had been *free* on every warm render became 3 queries that are never free.

A commit-sha check was added to claw that back — if the branch head has not moved, the backlog cannot
have changed, and the head comes from a conditional GET. It works: the three GraphQL queries are
skipped on a warm render. It did not recover the difference.

## Acceptance criteria
- [x] A cold venture board costs materially fewer than 86 requests: **53**, recorded above.
- [x] Both candidates decided on measurements, with the loser written down.
- [x] **Warm cost does not regress.** It did at the halfway point — 28 to 48 — and the ticket was
      written up as failing before being extended. Finished, it is **28 to 19**.
- [x] The read models still take an injectable source; the UI gate still runs offline on fixtures.
- [x] An operator can see how much of the budget is left. **Done at the third attempt** — it was
      carried unfinished through FB-077 and the first pass of this ticket.

## Extended, and now it is a win
The paragraph below was written when this ticket stopped at tickets-only, and the warm path had
regressed. Rather than merge a mixed result, the remaining bill was done too — and it was the larger
half all along.

The pull-request reads were costing **two list calls plus two calls per open pull request** — one for
the combined status, one for check runs. On ARCA that is 2 + 28 = **30 requests for one repository**.
GitHub's GraphQL carries the head commit and its `statusCheckRollup` on the pull request itself, so
all thirty become one query for two points. The preview link comes from the same contexts the rollup
already carries, which removes another call per pull request that FB-064 had added.

| | Original | Tickets only | **Tickets + pull requests** |
| --- | --- | --- | --- |
| Total requests, cold | 86 | 53 | **24** |
| Total requests, warm | 87 | 50 | **21** |
| **Paid, warm** | 28 | 48 | **19** |
| **Paid, cold** | 86 | 53 | **24** |

Warm is now **32% cheaper than before this ticket started**, not 71% more expensive. Cold is **72%
cheaper**. Roughly 260 board views an hour, against 178 before and 104 at the halfway point.

`statusCheckRollup: null` is carried through as `unknown` rather than as a failure — ARCA has no CI
and its rollup is null, which is the normal state of a young venture. That is the same distinction
FB-064 drew between "no checks" and "could not tell", kept rather than re-derived.

## What the halfway result looked like, kept as the record
This is not a clean win and it should not be merged as though it were.

**For keeping it:** a third fewer round trips means a faster page; the cold path — every deploy, every
restart — improved by a third; and the GraphQL points come from an allowance nothing else uses, so
5,000 REST requests an hour now buy more.

**Against:** the warm path is what a founder actually lives in, and it got more expensive. Roughly 104
board views an hour instead of 178.

**What would settle it properly** is the thing neither the ticket nor I costed: the remaining ~48
requests are pull-request lists, commit statuses, check runs and actions runs — one set per repository
per render. Those are now the whole bill, and GraphQL can fetch them in the same single query as the
tickets. That is where the next third goes, and it would take the warm path below where it started.

*(That is exactly what was then done — see above. The prediction was right and the remaining work was
larger than the part already finished, which is the argument for measuring at each step rather than
declaring victory at the first improvement.)*

## Verification
23 unit tests over the ticket fetcher, 8 new: a whole backlog from one query; the default branch read
from the same query (arca is `master`, and a wrong ref makes every file link 404); directories and
non-markdown ignored; **a truncated blob refetched rather than parsed as a shorter ticket** — GraphQL
declines to inline past ~512KB, and that is the kind of wrong that never announces itself; a missing
`text` refetched rather than becoming an empty ticket; no `docs/tickets` reading as empty and not
broken; a repository the studio cannot see never reading as an empty backlog (FB-021's distinction);
and a throwing query degrading one lane rather than blanking the board.

Two existing FB-021 tests were updated, not deleted — they stubbed the three REST calls this
replaced, and their properties still hold against the new one.

Then the real thing: three consecutive renders of the live ARCA board, numbers above.

## The last criterion, finished (2026-08-05)

It had been carried unfinished through two tickets: FB-077 measured the ceiling, FB-083 lowered it,
and through both of those **nobody could see how close the studio was to it.** The first sign of
running out would have been a founder's board quietly failing to show their work — which is the exact
failure mode CLAUDE.md #10 is about, sitting inside the ticket that measured everything else.

**It costs nothing, which mattered on this ticket in particular.** GitHub answers *every* response
with the remaining budget for the resource that response used, including a `304` — so the figure is
read off traffic the studio was already making, and it stays current precisely on the warm path where
things are going well. Asking `/rate_limit` would also have been free, but a number that arrives on
its own cannot be forgotten and is never stale in a way nobody notices.

Both allowances are shown, because the whole argument for moving tickets and pull requests onto
GraphQL was that it draws on a **separate** 5,000-point pool — an operator who sees only one cannot
see the headroom that bought. A resource the studio has not touched reads as *not heard yet* rather
than as a reassuring blank: "not heard" and "nearly empty" must never look the same.

Two surfaces: the admin block on the activity page for whoever is looking, and `/api/readiness` for
whatever notices before anyone is.

## And the polling FB-098 deferred here

FB-098 asked for a live board and deliberately did not build it, because it allowed polling "bounded
by FB-083's request-budget discipline" and no such budget existed. A warm board then cost 87
requests. It now costs 21, so this is both the ticket that made polling affordable and the PR where
the budget it must respect exists.

`components/WhileWorking.tsx`, bounded three ways — each closing a way it could quietly become
expensive:

- **only while a run is genuinely in flight** (most boards, most of the time, do not poll at all);
- **only while the tab is visible**, checked at fire time, so a board left open on a second monitor
  overnight costs nothing;
- **it stops when the work does.**

The cost, stated rather than buried: one board render a minute while a founder is watching their
ticket — roughly 60 an hour against the ~260 the budget now allows.

## What is honestly not covered

The budget strip's *rendering* is unit-tested and its plumbing is driven end-to-end through
`/api/readiness`, but the visible strip is never exercised with real numbers: the UI gate runs on
fixtures and never calls GitHub, so there is genuinely nothing to show. The e2e asserts the honest
empty case instead. Saying so here rather than implying a coverage that does not exist.