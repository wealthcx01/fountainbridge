# FB-070 — The board should tell the truth about what has shipped

**Status:** Done · **Phase:** 2 · **Depends on:** FB-004 (the parser), FB-007 (PR→status inference) ·
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
- [x] CI flags a ticket whose status contradicts the repository's own history. `make ticket-drift`,
      on every pull request, reading the full history.
- [x] No status is changed by the studio without a lane or a human action behind it — nothing here
      writes to a ticket. The check reports; a person decides.
- [x] A ticket whose work has merged shows as shipped — via the existing PR→ticket inference
      (FB-007) for work with a linkable open or recently-merged PR, and via this check catching
      everything it misses before it reaches a founder.
- [~] Where the file and git disagree, **the board** shows what git says and can explain why. The
      inference already prefers a merged PR over a stale file, but it does not yet *say* that it
      did. Surfacing the provenance on the card is founder-facing work and is written up separately
      rather than bolted on here.

## The first run found eighteen, not eight
The eight found by hand were the ones shipped that week. Run against the whole history, the check
found **eighteen** — FB-031 through FB-057, every one a feature that had been live for days or weeks
while its ticket said "In review" or "In progress". All eighteen are corrected in this change, and
FB-064 with them.

One is deliberately **not** marked Done. FB-044's gated executor is built, tested and gated, and it
has never been deployed to a machine. Marking it Done would be the same lie in a different place, so
it carries the escape hatch this ticket had to invent:

> **Shipped in part:** the executor is built, tested and gated, and it runs nothing yet.

Without that hatch a genuinely part-finished ticket could only pass the gate by claiming to be
finished — the exact failure the check exists to prevent, reached by a different route. It is a
visible line in the ticket rather than a hidden annotation, so a founder reading the ticket sees the
same explanation the build does.

## Two rules that looked right and were wrong
Both were caught by running the check against the real history rather than reasoning about it.

**"The message mentions the ticket id."** It reported FB-034 shipped on the evidence of
*"FB-050: the venture brain"* — a commit that referenced it in passing — and FB-039 on the evidence
of an FB-044 commit. The verdicts happened to be right and the reasons were wrong, which is worse
than being wrong outright: a check that cites the wrong reason is one a developer learns to skim.

**"The ticket's own file changed in a commit that also changed code."** This looked stronger and was
worse. One pull request can ship one ticket and *file five more* — which is exactly what
`docs: the founder's journey…` did — so every newly-filed ticket was created by a code-changing
commit and all five were reported as already shipped. Filing a ticket is not shipping it, and no
file-based signal can tell the two apart.

What survives is one rule: **a commit that changed code, whose subject names the ticket.** That is
the repository's own convention (one ticket, one branch, one pull request) and it is deliberate.
Its cost is stated rather than hidden: work shipped under a subject that does not name its ticket is
not caught — FB-064 is exactly that case, and had to be corrected by hand. The alternative was a
check that cries wolf, and a gate people switch off protects nothing.

## Verification
18 unit tests over the rules — what counts as evidence and what does not, both discarded rules
pinned as regressions, the escape hatch, and the one-directional promise that a ticket marked Done
with no commit behind it is never flagged (that noise is what teaches people to ignore a check).

Then the real thing: run against this repository's full history, it found eighteen genuine
disagreements and, after they were corrected, reports *"every ticket agrees with the history"*. It is
wired into CI with `fetch-depth: 0`, because a shallow clone would find nothing and pass — a check
that quietly does nothing is indistinguishable from one that found nothing.
