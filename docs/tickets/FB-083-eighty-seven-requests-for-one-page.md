# FB-083 — Eighty-seven requests to draw one page

**Status:** Todo · **Phase:** 2 · **Depends on:** FB-077 (which measured this and did not fix it) ·
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

## Acceptance criteria
- [ ] A cold venture board costs materially fewer than 86 requests, with the number recorded.
- [ ] The choice between GraphQL and the trees API is decided on measurements, and both are written
      down — including the one that lost.
- [ ] Warm cost does not regress.
- [ ] The read models still take an injectable source, and the UI gate still runs offline.
- [ ] An operator can see how much of the budget is left.

## Verification
The same method FB-077 used, because it is the one that worked: instrument, render the real ARCA
board three times from cold, and record the numbers in the ticket. Then the founder walk end to end
with no read failures.

And the check FB-082 taught: **after the change, walk it again and look at what the founder sees.** A
fix that does not change the screen has not been verified, it has only been deployed.
