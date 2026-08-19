# FB-060 — What the lane tells you, and in what shape

**Status:** Done — not yet deployed to a box · **Phase:** 2/3 · **Depends on:** FB-042 (the reader), FB-052 (the loop) ·
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
- [x] A ticket that asks the lane to flag what it could not establish results in those items being
      visible in the PR body — and **first**, above what it found. A summary is most likely to
      swallow exactly this, and burying it under the findings would repeat the fault more politely.
- [x] The PR body no longer depends on the last line of stdout. The implement phase writes
      `handoff.json`; `handoff-check.mjs` reads it; `tail -1` is gone.
- [x] New RunReports carry the contract fields — `lane_id`, `started_at`, `ended_at`, `trigger`,
      `outcome`, `summary_md`, `tickets_touched`, `error_detail`, `pr_url`.
- [x] Reports written before this ticket still render. Pinned by a test that runs the **real** writer
      program lifted out of `foundry-lib.sh` and feeds both shapes through `fromLaneRecord`.
- [ ] **Verified on a box.** Not done — see below.

## What shipped

### The hand-off (the fault the lane found in itself)

The implement phase now writes `handoff.json` — summary, what it could not establish, what it found,
caveats — and the harness reads it. Same seam as the PRP and the proposal: **the model writes a file,
bash validates it, the harness decides what happens next.** Scraping stdout made the PR body a
function of how chatty the model felt, which is not a contract.

Both the summary and the body fall back **loudly** rather than failing: by the time this runs the
work is done and its gates have passed, and losing the caveats must not mean losing the PR. The
fallback text says it is the harness's own words, so a founder is never handed a machine-generated
sentence that reads as the agent's account.

The file is cleared before every round, so a repair cannot inherit round 1's caveats and present
them as its own.

### The writer half of FB-042

The record is built by `runreport-record.mjs` — a file, like every other seam on this box
(`prp-check`, `proposal-check`, `handoff-check`), rather than a `node -e '…'` embedded in the shell.
It started as an embedded program and shellcheck was right to object: a program the linter cannot
read is one nobody can test either, and the first version of its test had to scrape it back out of
`foundry-lib.sh` by string matching. Now the test imports the module the shell actually calls.

`write_runreport` emits the contract shape **alongside** the lane vocabulary, not instead of it.
The reader has accepted both since FB-042 — reader first, deliberately — so this lands without a flag
day, and the legacy fields keep every report already on the ref readable. Dropping them is a separate
decision, once those have aged out.

The status→outcome map is the same one the studio uses. The two must not disagree about what a word
means, so the test asserts every status the lane can emit, and that an unrecognised one surfaces as
`blocked` rather than vanishing.

The contract's invariant is enforced on the way out as well as in: a run still in flight states
neither `ended_at` nor `outcome`, because half of that fact renders as something untrue.

## What is left

**Deploying it.** `handoff-lib.mjs`, `handoff-check.mjs` and the changed `supervisor.sh` /
`foundry-lib.sh` are on no box — lane files are copied by hand, the gap FB-113 closed for the
LibreChat side and has not closed here. Until they are, ARCA's lane keeps using `tail -1`.

The verification the ticket asks for — a real ticket on the box, the PR body carrying the
enumeration, the studio rendering an old and a new RunReport side by side — needs that deploy first.
