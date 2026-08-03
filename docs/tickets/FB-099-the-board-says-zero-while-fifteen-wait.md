# FB-099 — The board says zero while fifteen wait

**Status:** Todo · **Phase:** 3 · **Found by:** the founder walkthrough, 2026-08-03 ·
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

- [ ] The badge and the board columns show the same number, from the same computation.
- [ ] Each of ARCA's fifteen real PRs is either matched to its ticket (id + title shown) or
      deliberately unmatched with the fallback title — none double-counted, none invisible.
- [ ] Unit tests pin the matcher against the real PR/branch shapes the lane produces.
- [ ] No surface shows a raw branch name to a founder when a ticket title is known.
