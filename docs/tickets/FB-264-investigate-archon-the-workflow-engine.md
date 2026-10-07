# FB-264 — Archon or the studio's own lane: which one works ARCA's tickets

**Status:** Todo · **Phase:** 3 · **Kind:** a comparison and a recommendation, not a build ·
**Raised by:** John, 2026-10-03; **rewritten** 2026-10-07 after the re-baseline (PR #365) and John's
decisions on it · **Do not start until John says so.** · One ticket = one branch = one PR.

## What John decided, and what this ticket settles

On 7 October John agreed the split in principle. **Archon** works tickets. **Cowgate** runs the
machines and the spending caps. **Fountainbridge** keeps the founder's screens, the signed record of
approvals, and the approvals themselves.

He also said that until this comparison is done, **only one engine works ARCA**. So the studio's own
lane on ARCA's machine was paused that day (see "The lane is paused" below).

This ticket answers one question with evidence: **should Archon replace the studio's own lane as the
thing that works a venture's tickets, starting with ARCA?** It ends in a written recommendation. It
does not move anything.

## Why the question is narrower than it was

The first version of this ticket asked whether to adopt Archon at all. The factory has since adopted
it for every Bruntsfield repository (Cowgate, CG-0009 and CG-0010, 6 October 2026). It has already
merged ARCA work: ARCA-075 and ARCA-077.

What is left is the venture question. The two engines have now both worked ARCA, and they collided:

- The lane's pull request for ARCA-072 (arca #96) files three new tickets as ARCA-074, ARCA-075 and
  ARCA-076. Archon's work had already used ARCA-074 and ARCA-075 for different tickets. Merging #96
  would create two tickets with the same number.
- Three of the lane's finished pull requests (ARCA-069, 070 and 071) no longer apply to ARCA's main
  branch. Archon's merges this week changed the same files.

Two engines on one repository, neither aware of the other, is the problem John's "one engine" rule
fixes. This ticket decides which engine stays.

## What to compare

### 1. Evidence that already exists (read, don't re-run)

- **The lane:** 40 pull requests merged into ARCA since August, from branches named `foundry/…`. Its
  known faults, each with its ticket: a released plan was planned again every five minutes for five
  weeks (FB-251); stacked branches that went stale while waiting (ARCA-069 to 071); and ticket
  numbers chosen without seeing other work (#96).
- **Archon:** its first ARCA run (ARCA-075, run `f47156df`) failed after 37 minutes and about $18.60.
  The review step edited files and the work went outside its approved scope. Cowgate's record of the
  run is `docs/runs/2026-10-06-arca-075-f47156df/`. After CG-0010's fixes, ARCA-075 (arca #102) and
  ARCA-077 (arca #103) merged.

### 2. A fresh head-to-head on the same tickets

Pick **three small ARCA tickets** that neither engine has touched. ARCA-078, ARCA-080 and ARCA-081
were all `Planned` and untouched on 7 October. Recheck before starting, and pick others if those
have moved.

Run **each engine once on each ticket**, in a sandbox, so that neither touches real ARCA:

- **A private scratch copy of the ARCA repository** (for example `wealthcx01/arca-sandbox`), made
  fresh from ARCA's main branch. Creating it is a write to GitHub, so ask John before making it. In
  the copy, set the three tickets to `Todo` so the lane will pick them.
- **The lane:** run `run-once.sh` by hand on ARCA's machine with its repository pointed at the copy.
  Leave `foundry-lane.timer` disabled throughout, so the pause stays in force for real ARCA.
- **Archon:** run `bruntsfield-ticket` on the planning box against a checkout of the copy. Approve
  each plan exactly as written, with no extra guidance, so neither engine gets help the other did
  not get.
- **No external action is possible from either.** Neither has send, spend or deploy credentials.
  Confirm that before starting rather than assuming it.

Then record, per ticket and per engine:

| what | how it is measured |
| --- | --- |
| Did it finish? | an open pull request in the copy, or not |
| How long | wall-clock from start to pull request |
| What it cost | Archon's run budget figure; for the lane, the number of Claude sessions and their usage |
| Did it pass first time? | the repo's own checks and `/review`, with no human fix |
| Did it stay in scope? | files changed against the ticket's own scope |
| Does it still apply? | merges cleanly onto the copy's main branch on the day it finishes |
| Could a founder read it? | the plan and the pull request description, judged against non-negotiable 12 |
| Human steps needed | every time a person had to step in, and why |

### 3. How each fits the rest of the studio

Answer each of these in a sentence or two:

- **Where it would run.** The planning box has 7.6 GB of memory and runs two Archon runs at a time.
  ARCA's machine has spare room. Cowgate's Railway runners (CG-0001 to CG-0004) do not exist yet.
  Until they do, where would Archon work ARCA's tickets?
- **Plan approval by a founder.** Archon pauses for a plan approval in its own dashboard, which only
  John can reach. How would a founder approve a plan in the studio instead (the "approve an Archon
  plan from the studio" ticket proposed in the re-baseline)?
- **Keeping ventures apart.** One Archon serves all thirteen repositories. What must the studio check
  on the server so a founder only ever sees their own venture's runs?
- **The hold-out reviewer.** The lane's review is a fresh session that cannot see how the builder
  reasoned (FB-222). Confirm Archon's review step has the same property.
- **What stays on ARCA's machine** if the lane retires: the brain, the office, the composer, the
  approval record. Confirm none of them depends on the lane's timer.

## The lane is paused

On 7 October 2026 at about 21:12 UTC, `foundry-lane.timer` on ARCA's machine (`venture-arca`,
167.233.160.141) was stopped and disabled. Nothing was deleted. The memory refresh
(`foundry-brain-sync.timer`) and the secret scan (`foundry-secret-scan.timer`) still run.
`/opt/foundry/lane/PAUSED.txt` on the machine says the same thing.

**To resume it, on ARCA's machine as root:** `systemctl enable --now foundry-lane.timer`

While it is paused, the desk will stop saying "Your team checked in N minutes ago". The lane wrote
that check-in on each wake. A stale check-in is expected during the pause and is not a fault.

## Out of scope

- Moving ARCA to Archon, retiring the lane, or resuming it. Those follow John's decision on this
  ticket's recommendation.
- Running Archon on any venture machine.
- Anything that touches real ARCA: no pull requests against it, no ticket status changes on it.
- THE RESET, which John has parked until ARCA runs cleanly on the new setup.

## Acceptance criteria

- [ ] The existing evidence for both engines is summarised, with links to the pull requests and the
      run record.
- [ ] Three ARCA tickets were worked by both engines in a sandbox copy, and the table above is
      filled in for all six runs, with the numbers.
- [ ] Each of the five fit questions has a plain answer.
- [ ] A recommendation in plain English: **move ARCA to Archon**, **keep the lane**, or **move later,
      once a named condition is met**. It lists the follow-up tickets it implies.
- [ ] Real ARCA was not touched, and the lane's timer stayed disabled throughout. Say how that was
      checked.
- [ ] The sandbox copy is deleted at the end, or John has said to keep it.
