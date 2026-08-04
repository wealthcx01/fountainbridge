# FB-099 — The board says zero while fifteen wait

**Status:** Done · **Phase:** 3 · **Found by:** the founder walkthrough, 2026-08-03 ·
**Repo:** fountainbridge · **Branch:** `fb-099-the-board-says-zero-while-fifteen-wait` ·
One ticket = one branch = one PR.

## The contradiction on one screen

On ARCA's venture board, at the same moment:

- The navigation badge says **"Needs you — 15"**, and the brief's first line says *"15 pull
  requests are open for review."*
- Every lane's **"NEEDS YOUR OK"** column says **0**.

Both numbers are computed honestly from different sources, and a founder cannot know that. The
columns group **ticket files** by their Status line (`pr-open` comes from status inference matching
a PR to its ticket), while the badge counts **open PRs** from the GitHub API. The fifteen real PRs
— the lane's worked tickets, filed under branch names like `foundry/bulk-daily-price-feed-plan` —
match no ticket file's slug, so inference attaches none of them, the columns stay zero, and the two
numbers sit six centimetres apart telling different stories. FB-068's one-format-one-alarm rule was
about exactly this: one fact, one number.

## What else the mismatch breaks

- A founder who trusts the columns concludes there is nothing to review and never opens the queue;
  a founder who trusts the badge concludes the columns are broken. Either way the board loses.
- The attention queue's titles are the raw PR titles, so the same items appear there as
  "build: bulk-daily-price-feed-plan (Foundry lane)" — branch-speak (FB-076's territory) — while
  the board shows the human ticket titles. The founder has no way to connect the two lists.

## Scope

- **One source for "waiting on you".** The board's per-lane count and the badge derive from the
  same computation (the attention model), so they cannot disagree. The columns' `pr-open` grouping
  either consumes that model or is renamed to what it truly counts.
- **Connect PRs to tickets by content, not slug-guessing.** The lane's PRs edit exactly one ticket
  file's Status line (that is how inference already works when it works) — extend the matcher to
  the lane's actual branch/PR shapes (`foundry/<slug>`, "(Foundry lane)" suffixes), with unit
  tests over the fifteen real PR shapes from `wealthcx01/arca` as fixtures.
- **The queue names work the way the board does** — ticket id + human title when a ticket is
  matched, falling back to the PR title only when nothing matches (and FB-096/FB-060 shrink that
  fallback over time).

## Explicitly NOT here

- Queue **sizing** — fifteen open reviews may simply be too many to show a founder undifferentiated,
  but that is the standing design question from the 2026-08-02 handoff, and it deserves John's eye,
  not a unilateral cap in a bug-fix ticket.
- Changing lane branch naming on the box (FB-060's structured hand-off is the durable fix; the
  studio should still present today's history well).

## Acceptance criteria

- [x] The badge and the board columns show the same number, from the same computation. — pinned by
      an e2e that reads both numbers off the two pages and asserts they are equal.
- [x] Each of ARCA's fifteen real PRs is either matched to its ticket (id + title shown) or
      deliberately unmatched with the fallback title — none double-counted, none invisible.
- [x] Unit tests pin the matcher against the real PR/branch shapes the lane produces.
- [x] No surface shows a raw branch name to a founder when a ticket title is known.

## What shipped

`lib/ticket-match.ts` — all three shapes the lane produces, in one place, tried in order of how much
the work states about itself: the id outright, then the branch slug (`foundry/<slug>`), then the slug
out of the title once "build:" and "(Foundry lane)" are taken off it.

**It never guesses.** A slug that matches nothing stays unmatched, and an id that names a ticket the
studio cannot see does NOT fall through to slug-guessing: `ARCA-99` means the author meant ARCA-99,
and matching it to something similar would be silently wrong rather than visibly unmatched.

## Two things the fix turned out to need

- **Unmatched work has to be on the board.** Matching alone cannot make the two numbers agree,
  because some work genuinely has no ticket — and that work was falling between the badge (which
  counted it) and the columns (which could not show it). It now appears in "Needs your OK" as a card
  that says *"No ticket — finished work your team did not tie to anything you asked for"*, and can
  still be read and decided. Inventing a match to make the columns add up would have been the same
  failure in the opposite costume.
- **"Unmatched" means "has no card on this board", not "has no id".** Work titled *"ARCA-5: deck
  sharing"* whose ticket file does not exist has an id, matches nothing on screen, and fell through
  exactly the same gap. Found by the count-agreement test, which is why that test asserts the numbers
  rather than the mechanism.

## One structural change worth knowing

The attention cache now stores **the network read** and derives the matching on every read. Caching
the derived view instead would mean whichever page loaded first decided how well the whole studio
matched for the next two minutes — the queue (which had no tickets to hand) would poison the board.
The tickets are threaded in from both pages through one helper, `lib/venture-tickets-index.ts`, so
the two surfaces cannot answer "how much is waiting?" from different knowledge again.
