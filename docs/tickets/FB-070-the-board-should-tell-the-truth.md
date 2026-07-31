# FB-070 — The board should tell the truth about what has shipped

**Status:** Todo · **Phase:** 2 · **Depends on:** FB-004 (the parser), FB-007 (PR→status inference) ·
**Repo:** fountainbridge · **Branch:** `fb-070-the-board-should-tell-the-truth`
One ticket = one branch = one PR.

## Why this matters (for the founder)
The board is the answer to "what is happening in my company". If it says work is still in progress
when it shipped days ago, the founder stops trusting it — and a board nobody trusts is worse than no
board, because they will go and check somewhere else.

## What is wrong
Found on 2026-07-31 by checking the ticket files against git. **Eight tickets said "In review" or "In
progress" for work that was merged and deployed**, including everything shipped that day. One said
"In progress" for a feature that had been live for hours.

Nothing marks a ticket as shipped. The lane flips `Todo` → `In progress` when it claims a ticket
(FB-040), and then nothing ever moves it on. A human merging a PR does not touch the ticket file, so
the last recorded truth is whatever state the work was in when someone last thought to edit it by
hand.

The studio does infer *some* state from pull requests (FB-007 maps an open PR to `pr-open` and a
merged one to `done`), but that only works when a PR can be linked to a ticket id. For a ticket whose
PR has merged and closed, the file's own `Status` line is what shows — and it is stale.

The eight were corrected by hand in the same commit that filed this ticket. Correcting them by hand
is not a fix; it is the reason to build one.

## Scope
- **Mark a ticket shipped when its work merges.** The obvious place is the same moment the lane
  already writes a RunReport — it knows the ticket and the PR. For human-merged work, the studio's
  existing PR→ticket inference should win over a stale file rather than deferring to it.
- **Where inference and the file disagree, prefer the evidence and say so.** A merged PR is stronger
  evidence than a line someone forgot to edit; the board should show the truth and be able to explain
  where it got it.
- **Fail loud on drift.** A check that flags tickets whose recorded status contradicts git — so this
  is caught by CI rather than by someone noticing months later.

## Out of scope
- Changing the status vocabulary itself.
- Any write-back that would make the studio edit tickets without a human or a lane behind it.

## Acceptance criteria
- [ ] A ticket whose work has merged shows as shipped, without anyone editing the file.
- [ ] Where the file and git disagree, the board shows what git says and can explain why.
- [ ] CI flags a ticket whose status contradicts the repository's own history.
- [ ] No status is changed by the studio without a lane or a human action behind it.

## Verification
`/review` + CI, plus the specific regression: take a ticket from `Todo` through a lane run and a
merge, and confirm the board reaches shipped on its own.
