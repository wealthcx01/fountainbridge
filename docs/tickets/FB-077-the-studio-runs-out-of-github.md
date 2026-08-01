# FB-077 — The studio runs out of GitHub during ordinary use

**Status:** Done · **Phase:** 2 · **Depends on:** FB-020 (App auth), FB-021 (repo access) ·
**Repo:** fountainbridge · **Branch:** `fb-077-the-studio-runs-out-of-github` ·
One ticket = one branch = one PR.

## Why this matters (for the founder)
Parts of your studio go blank for a while, and the reason is that the studio asked GitHub too many
questions. You did nothing wrong and there is nothing you can do. From where you sit, the product is
simply unreliable — sometimes your workstreams are there and sometimes they are not.

## What was found
Walked on 2026-08-01. One founder, signed in, clicking through their own studio at human speed: sign
in, open a venture, open the composer, ask one question, open the attention queue. No load, no loop,
no refresh spamming.

By the fifth page, three of five repositories were failing with **"GitHub rate limit hit — try
refresh shortly"** — `arca-marketing`, `arca-ops`, `modernisation-engine`.

That is not a busy-Tuesday problem. That is a single user, walking the primary path once, exhausting
the budget.

## Why it is happening
The studio reads git for everything, which is the architecture working as intended — git is the
source of truth, there is no second database. The cost is that one page view fans out into a lot of
requests, and several pages each do their own fanning:

- tickets, per repository, per venture,
- open and recently-closed pull requests, per repository,
- repository health — default branch, protection, latest run, activity — per repository,
- approvals, per department repository,
- **since FB-064**, a combined status *and* a check-runs call per open pull request,
- **since FB-071**, a directory listing plus a file read per approval, for the history.

The last two are the newest and the most expensive, and both were added in the last two days. FB-064's
own comment notes the CI read was kept to open pull requests "to bound quota" — that bound was
calculated before FB-071 added another read per approval on the same page.

There is a per-venture cache, so this is not unbounded. But the caches are per surface and the
walk crosses several surfaces, so a founder moving through their own studio pays repeatedly.

## Scope
- **Measure before changing anything.** Add a counter to the GitHub client that reports requests per
  page render, in development and in the logs. Right now the true number per surface is not known,
  only inferred from the code, and the fix should be aimed at the real hot spot rather than the
  suspected one.
- **Share one cache across a request**, so a page that reads the same repository from three read
  models pays once rather than three times.
- **Stop paying twice for the same commit.** FB-064's checks read and FB-064's preview read both call
  `/commits/:sha/status`. That is two identical requests, in the same render, for the same answer.
- **Use conditional requests.** GitHub does not count a `304 Not Modified` against the rate limit.
  Most of what the studio reads changes rarely; storing the ETag and sending `If-None-Match` should
  remove a large fraction of the cost for no loss of freshness.
- **Degrade in a way a founder can act on.** Today the message is "try refresh shortly", which is
  advice a founder cannot evaluate. It should say when it will recover, and — if the studio knows it
  is rate-limited — it should not send more requests until then, because retrying is what deepens the
  hole.
- **Check whether the App's limit is the right one.** A GitHub App installation has a higher and
  separately-pooled budget than a personal token; if the studio is falling back to a token for some
  reads, that is worth knowing before optimising anything.

## What the measurement found — and how it contradicted this ticket
This ticket guessed the cause was the hourly budget. **It was not.** Instrumenting the client and
rendering a real ARCA venture board three times:

```
1st render (cold)   sent= 86  free304=  0  coalesced= 5  PAID= 86  peakConcurrent=87  rateLimited=0
2nd render (warm)   sent= 87  free304= 59  coalesced= 4  PAID= 28  peakConcurrent=87  rateLimited=0
3rd render (warm)   sent= 86  free304= 59  coalesced= 5  PAID= 27  peakConcurrent=87  rateLimited=0

budget: 485 used of 5,000
```

**Zero primary rate limits, across three renders, with the hourly budget barely touched.** The App
installation has 5,000 requests an hour and was using a few hundred.

So the "GitHub rate limit hit" the founder walk produced was almost certainly a **secondary** rate
limit — GitHub's separate throttle on *concurrent* bursts. The studio fanned 87 requests out with
`Promise.all`, so they all left at once. That is the shape GitHub throttles, and it explains why
three repositories failed while the budget was untouched.

The ticket's own instruction — *"measure before changing anything… the fix should be aimed at the
real hot spot rather than the suspected one"* — is what caught this. Optimising the hourly budget
would have been a day's work aimed at the wrong thing.

### Where the 87 go
```
  7  /repos/*/pulls              5  /repos/*/commits/*/status
  5  /repos/*/commits/*/check-runs   3  /repos/*/actions/runs
  3  /repos/*                    3  /repos/*/commits
  2  /repos/*/branches/main/protection
```
…and the rest is **one request per ticket file**. That is the bulk, and it is also the part that
almost never changes — which is exactly what conditional requests are for.

## What was built
Three mechanisms, each costing nothing when it does not apply.

**Conditional requests.** The client stores each URL's ETag and sends `If-None-Match`. GitHub does
not count a `304 Not Modified` against the rate limit, so a warm render pays for 28 requests instead
of 86 — **a 68% cut**, and the saving comes almost entirely from the ticket files.

**Coalescing.** The same URL asked for twice while the first is in flight is one request. Four to
five per render, including the `/commits/:sha/status` that FB-064 asks for twice by itself — once
for the checks and once for the preview.

**A concurrency cap** — the one aimed at the failure actually seen. Eight in the air at once, down
from 87. GitHub's own guidance is to avoid concurrent requests; the burst is no longer a burst.

**And a closed door.** On a *primary* limit the client records the reset and refuses every read until
then, rather than retrying into it — each refused request still counts against the secondary limits,
and a page that fans out dozens of them makes the hole deeper. A *secondary* limit carries no reset
and deliberately does not close the door: that is a two-second hiccup, and blocking for an unknown
period would turn it into a blank page.

## Out of scope
- How the failure is *worded* on the attention queue — that is FB-076.
- Any move away from git as the source of truth. The architecture is not the problem; the request
  count is.

## Acceptance criteria
- [x] Measured and recorded, before and after: **86 paid cold, 28 paid warm**, peak concurrency
      **87 → 8**.
- [x] Repeated reads of the same commit within one render happen once — 4 to 5 coalesced per render.
- [x] Conditional requests are used: 59 of 87 reads come back as free `304`s on a warm render.
- [x] When rate-limited by the primary budget the studio stops asking and records when it expects to
      work again, rather than retrying into it.
- [~] **A founder can complete the full walk without a rate-limit failure.** The re-walk after this
      change was clean, but the original failure was never reproduced under measurement — it did not
      recur once in three instrumented renders, before or after. So this is "the burst that caused it
      is gone", not "the failure was reproduced and then fixed". Stated as the weaker claim because
      that is the one the evidence supports.
- [ ] **`githubBlockedUntil` is not shown to the founder yet.** The studio knows when it expects to
      recover and still says "try refresh shortly". Wiring that into the words is FB-076's job, and
      this ticket deliberately did not reach into it.

## Verification
21 unit tests over the client, nine new: the ETag sent back and the body surviving a 304; two
concurrent asks becoming one request; a write never coalesced or cached (a `PUT` folded into another
`PUT` is a write that silently did not happen); a rate limit counted so it can be measured; a fresh
answer replacing a stale one; the door closing on a primary limit; the reset reported; the door
**not** closing on a burst limit; and the door opening again once the reset passes.

Then the real thing: three consecutive renders of the ARCA venture board against live GitHub, with
the numbers above recorded in this ticket.

## What is still true, and worth knowing
**87 requests for one page view is a lot**, and this ticket did not change that — it changed what
they cost. Warm, that is 28 paid, or roughly 178 board views an hour inside the App's budget. Cold —
after a deploy, when the cache is empty — it is 86, or about 58.

The honest next lever, if that is ever not enough, is to stop reading ticket files one at a time.
GitHub's GraphQL API can fetch many files in one query and draws on a **separate** 5,000-point
budget that the studio currently does not touch at all. That is a real change to the read model
rather than a tuning of the client, so it is named here and not attempted.
