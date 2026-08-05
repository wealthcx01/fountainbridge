# FB-096 — "Merged" does not mean what the founder thinks it means

**Status:** Done · **Phase:** 3 · **Found by:** the founder walkthrough, 2026-08-03, holding the
activity feed and the running product side by side · **Repo:** fountainbridge ·
**Branch:** `fb-096-merged-does-not-mean-what-the-founder-thinks` · One ticket = one branch = one PR.

## The moment that breaks trust

The activity feed says, three days ago: **MERGED — Replace Bloomberg/Pokemon tagline on sign-in
page.** The founder opens their product. The sign-in page still says *"The Bloomberg Terminal for
Pokemon Cards."*

Both facts are true. What merged was the **ticket file** — the *request* to do the work — and the
work itself was later tried three times by the lane, failed its own review, and was parked by the
circuit breaker. But the feed's word for both events is the same word, and to a founder "merged"
next to a change they asked for means *my product now does this*. The one page whose whole job is
"what has been happening" teaches the founder, on first contact with reality, that it cannot be
trusted — and FB-070's lesson applies verbatim: a founder who catches the board lying once stops
believing the rest of it.

## Three feed defects, one cause

The feed renders git events in git's vocabulary rather than the founder's:

1. **Filing reads as shipping.** A PR that adds `docs/tickets/…` is a *request being accepted into
   the queue*; a PR that changes the product is *work shipping*. The feed must distinguish them —
   "Ticket filed: Replace Bloomberg/Pokemon tagline" vs "Shipped: …" — and a filed ticket whose
   work later parks should surface that state where the founder will meet it, not only in a
   RunReport panel (the walkthrough found the tagline ticket's parking visible nowhere on the feed).
2. **Every merge appears twice.** Each MERGED row is shadowed by a COMMIT row saying the same words
   ("MERGED: X" followed by "COMMIT: X"), because the merge commit and the PR are reported as
   separate events. One human event, one row.
3. **Machinery leaks.** "cleanup: FB-043 test artifact", "test: sensitive Todo ticket",
   "seed: arca-ops — the queue, the context…" are platform plumbing, meaningful to Bruntsfield and
   noise to a founder. The feed already has an admin/founder split (FB-087's wiring warning);
   plumbing events belong on the admin side of it.

## Scope

- Classify events server-side (in `lib/` where the feed is composed, unit-testable): ticket-filed /
  work-shipped / knowledge-added (the `context:` deposits already read well) / plumbing. The
  classifier reads the PR's changed paths — `docs/tickets/` only ⇒ filing — not the title.
- Collapse the merge+commit pair into one row.
- Founder view hides plumbing; admin view keeps everything.
- A filed ticket that the lane has since **parked** carries that state in the feed row — the
  founder's answer to "whatever happened to the tagline fix?" must exist somewhere they look.

## Explicitly NOT here

- Renaming the lane's branch/PR conventions on the box (the feed should present well whatever git
  contains — FB-060 owns the structured hand-off).
- The live "being worked" experience (FB-098); this ticket is about the record being truthful,
  that one is about watching it happen.

## Acceptance criteria

- [x] A docs-only ticket PR renders as a filing, never as shipped work. — "asked for" vs "shipped",
      decided by the paths.
- [x] One merge produces one row.
- [x] The founder feed contains no seed/test/cleanup plumbing; the admin feed still does — and the
      founder is *told* the housekeeping exists rather than having rows quietly disappear.
- [x] A parked ticket is visibly parked wherever its filing appears. — *"— tried since, and stopped.
      It needs a person."*
- [x] Unit tests cover the classifier on real path-shapes from `wealthcx01/arca`'s history.

## What shipped

`lib/activity-kind.ts`: classify (from paths, never the title), dedupe the merge/commit pair, and the
founder/admin split — all pure, 19 cases.

**It claims nothing it does not know.** Where the paths were not looked up the meaning is `unknown`
and the row keeps its plain git word. Guessing "shipped" for an unclassified event is exactly the lie
this ticket exists to stop, so the fallback had to be the honest one rather than the useful-looking
one.

## The cost, stated

Classification needs the paths, and the paths are one request per merged change. That is on the very
page **FB-083** (*eighty-seven requests for one page*) is about, so the lookup is **capped at the 12
most recent merged changes** — the feed is newest-first and bounded, so the cap covers what is on
screen and anything older falls back to `unknown`. The parked annotation costs one run-history read
per venture on the same page.

Both are bounded per page-load rather than repeating on a timer — which is the distinction that made
polling the wrong call in FB-098 and makes these the right one. **FB-083 should fold both into its
budget**, and the cap is a constant in one place so it can.

## One narrow exception to "read the paths, not the title"

A `seed:`, `test:`, `cleanup:` or `chore:` prefix is housekeeping whatever it touched. These are
events the machinery made about itself, and the walkthrough met all three of them in a founder's
feed. Everything else is decided by what actually changed.
