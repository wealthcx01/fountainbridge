# FB-076 — The attention queue speaks machine, and leads with failures

**Status:** Todo · **Phase:** 3 · **Depends on:** FB-007 (the queue), FB-064 (the work view) ·
**Repo:** fountainbridge · **Branch:** `fb-076-the-attention-queue-speaks-machine` ·
One ticket = one branch = one PR.

## Why this matters (for the founder)
The attention queue is where a founder goes to answer "what needs me?". Today the first thing on it is
a paragraph of technical failures about repositories they have never heard of, and every item on it is
labelled `CI UNKNOWN`.

Both teach the same lesson in the first two seconds: *this page was not written for you*.

## What was found
Walked on 2026-08-01, signed in, on `/attention`.

**The page opens with a wall of failures.** Above the actual work, in a warning box:

> Some repos couldn't be read: arca-marketing: GitHub rate limit hit — try refresh shortly. ·
> arca-ops: GitHub rate limit hit — try refresh shortly. · modernisation-engine: GitHub rate limit
> hit — try refresh shortly. · thereset-platform: Repository wealthcx01/thereset-platform not found.
> · thereset-marketing: Repository wealthcx01/thereset-marketing not found.

Five failures, two entirely different causes, run together into one sentence with `·` separators. It
names five repositories by their machine names. It is the first thing on the page and it is longer
than any real item below it. And it gives the founder nothing to do — "try refresh shortly" for three
of them, and nothing at all for the other two.

Surfacing failure is right (CLAUDE.md #10). Surfacing it *like this* is not: it is a log line wearing
a warning box.

**Every item says `CI UNKNOWN`.** In small capitals, in a monospace tag, beside every piece of work.
It means "this repository has no automatic checks" — which is true of ARCA, and completely fine. The
work view learned to say that in plain English (*"This work has no automatic checks"*, FB-064). The
queue still says `CI UNKNOWN`, which reads to a founder as something being wrong.

**The page has two names.** The nav says **Attention**. The heading says **Awaiting review**. The
intro says "Everything across your ventures waiting on your OK." Three phrasings for one idea, and
"review" in particular is a word that means something specific and different in engineering.

**A rate limit happened during an ordinary walk.** Not under load, not in a loop — one founder,
clicking through their own studio. That is its own ticket (FB-077), but it shows up here first,
because this is the page where it becomes the founder's problem.

## Scope
- **Rewrite the failure box for a person.** Group by cause, not by repository. Say what it means and
  what happens next: *"Two of your workstreams could not be read just now because the studio has been
  asking GitHub too often. It will clear on its own — refresh in a minute."* Separate that from
  *"One workstream points at a repository that does not exist yet"*, which is a setup problem and
  never clears on its own.
- **Move it below the work when there is work.** A founder came here to answer something. A degraded
  read is context for what they see, not the headline.
- **Use the founder-facing check vocabulary from FB-064**, so a repository with no CI reads as "no
  automatic checks" rather than `CI UNKNOWN` — and so the same fact is worded identically on the
  queue and on the work view.
- **Name the page once.** Pick between "Attention" and "Awaiting review" and use it in the nav, the
  heading and the introduction. (FB-067 and FB-068 are adjacent; this is the specific instance.)
- **Say what a founder can do about a repository that is missing**, since "try refresh" is false for
  that case.

## Out of scope
- Fixing the rate limit itself (FB-077).
- The number of items in the nav or their grouping (FB-067).

## Acceptance criteria
- [ ] No raw repository names or machine phrases appear in the failure box.
- [ ] Failures are grouped by cause, and each group says what happens next — including "this one will
      not clear on its own".
- [ ] When there is work waiting, the work is above the failures.
- [ ] No item shows `CI UNKNOWN`; a repository with no checks says so in the same words the work view
      uses.
- [ ] The page has one name across nav, heading and introduction.

## Verification
`/review` + CI, then a screenshot of `/attention` in the degraded state that produced this — some
repositories rate-limited, some genuinely missing — showing work first, one clear sentence per cause,
and no machine vocabulary anywhere on the page.

Then the healthy state, to confirm the page is calm when nothing is wrong rather than merely quieter.
