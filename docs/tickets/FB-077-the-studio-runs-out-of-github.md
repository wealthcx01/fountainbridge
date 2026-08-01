# FB-077 — The studio runs out of GitHub during ordinary use

**Status:** Todo · **Phase:** 2 · **Depends on:** FB-020 (App auth), FB-021 (repo access) ·
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

## Out of scope
- How the failure is *worded* on the attention queue — that is FB-076.
- Any move away from git as the source of truth. The architecture is not the problem; the request
  count is.

## Acceptance criteria
- [ ] The number of GitHub requests per page render is measured and recorded in the ticket, before
      and after.
- [ ] A founder can complete the full walk — sign in, venture, composer, ask, attention, accept —
      without a single rate-limit failure.
- [ ] Repeated reads of the same commit within one render happen once.
- [ ] Conditional requests are used where the data allows it.
- [ ] When the studio is rate-limited it stops asking, and tells the founder when it will recover
      rather than advising a refresh that makes it worse.

## Verification
`/review` + CI, then the walk that produced this, run three times back to back from a cold cache, with
the request counter's output recorded in the ticket. Zero rate-limit failures across all three.

Then the honest negative test: force the limit deliberately and confirm the studio stops asking, says
something a founder can act on, and recovers on its own without anyone pressing anything.
