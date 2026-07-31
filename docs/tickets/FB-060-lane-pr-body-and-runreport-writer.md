# FB-060 — What the lane tells you, and in what shape

**Status:** Planned · **Phase:** 2/3 · **Depends on:** FB-042 (the reader), FB-052 (the loop) ·
**Repo:** fountainbridge (+ venture box) · **Branch:** `fb-060-lane-pr-body-and-runreport-writer`
One ticket = one branch = one PR.

## Why this matters (for the founder)
When an agent finishes a piece of work, what it tells you should be the whole of what it found — not
the last sentence it happened to say. Right now a ticket can ask it to flag what it could not
establish, the agent can dutifully do so, and the answer never reaches you.

## Context
Two findings from the first real Sell run on ARCA's box (2026-07-31).

**The lane found the first one itself.** SELL-001 asked it to "flag, in the PR description, anything
you could not establish from the repos rather than filling it in with a plausible guess". It did the
work, listed the founder-only facts it could not source — price tiers, competitors, brand voice — and
then its own coverage gate failed, because `supervisor.sh` builds the PR body from `tail -1` of the
implement log. One line. The enumeration the ticket asked for could not reach the PR no matter how
well the agent did its job. An agent catching a limitation of its own harness is worth acting on.

**The second is the writer half of FB-042.** The studio now reads RunReports and normalises two
shapes: the lane's own and the bcap-contracts one. That was deliberate — reader first, so the studio
understands everything already on the ref — but the migration is only half done while the lane still
emits its own vocabulary.

## Scope
- **A structured hand-off from the implement phase.** The lane writes a small file (findings,
  caveats, what it could not establish) that the supervisor reads into the PR body, instead of
  scraping stdout. Same shape as the PRP and proposal seams: the model writes a file, bash validates
  it, the harness owns what happens next.
- **Preserve the one-line summary** for the RunReport, which is where a single sentence is right.
- **Emit RunReports in the contract shape** (`lane_id`/`started_at`/`trigger`/`outcome`, the FB-059
  outcome vocabulary, `pr_url`, `error_detail`). The reader already accepts both, so this can land
  without a flag day and old records stay readable.
- **Keep the legacy reader** and say so in a comment with a date — it protects every report written
  before this ticket, and deleting it is a separate decision made once those have aged out.

## Out of scope
- Cost/token accounting per run (no source for it on the box yet).
- Changing the RPIV loop's phases.

## Acceptance criteria
- [ ] A ticket that asks the lane to flag what it could not establish results in those items being
      visible in the PR body.
- [ ] The PR body no longer depends on the last line of stdout.
- [ ] New RunReports validate against the bcap-contracts `RunReport` schema.
- [ ] Reports written before this ticket still render in the studio.

## Verification
`/review` + CI, then a real ticket on the box: the PR body carries the enumeration, and the studio
renders both an old and a new RunReport in the same activity strip.
