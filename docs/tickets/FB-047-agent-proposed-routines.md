# FB-047 — Agent-proposed routines (fully apply meridian's routines + Cofounder parity)

**Status:** In progress — the model is in, the surfaces are not · **Phase:** 3 · **Depends on:** FB-040 (scheduler), FB-042 (RunReports) · **Repo:**
fountainbridge (+ venture VM) · **Branch:** `fb-047-agent-proposed-routines` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Recurring work runs itself, but on your terms: the agent *proposes* a standing routine (e.g. "each week,
work the new sign-ups"), you approve/pause/run-now from the studio, and you always see its last result.
A cron becomes a product you control.

## Context
FB-040's scheduler is an invisible timer. Cofounder's routines carry criteria, last-result, pause/
resume/run-once — and their agents *propose* routines (parity-critique §7; meridian's autopilot with a
per-agent cooldown + one-dispatch-per-sweep, `docs/ideas-from-meridian.md`). This applies that fully.

## Scope
- A lane can **propose a routine** as a ticket (standing order + cadence + a "useful work?" criterion);
  the founder approves/pauses/runs-now from the studio.
- The scheduler honours founder-controlled routines + a **per-ticket cooldown** and one-dispatch-per-sweep
  (meridian) to keep the queue shallow and spend smooth.
- The studio surfaces each routine's state + last RunReport (reads FB-042).

## Out of scope
- The core autonomous loop (FB-040). External-action routines still gate (FB-044/051).

## Acceptance criteria
- [ ] A lane can propose a routine; the founder approves/pauses/runs-now in the studio. — *the model
      and its state machine are in (`lib/routines.ts`); the studio surface and the actions are not.*
- [ ] The scheduler runs approved routines with a cooldown; the studio shows state + last result. —
      *the cooldown and the one-dispatch-per-sweep decision are in and tested; the box-side
      scheduler does not read them yet.*

## Progress — the part both sides need, first

`lib/routines.ts` is the routine itself: its shape, its state machine, and the decision about what
runs next. It is deliberately the first piece, because the box decides what to run and the studio
has to show a founder what *will* run and why nothing is running right now — the same question, and
answering it in two places is how the two come to disagree.

**The rule that matters most is that a lane cannot approve its own routine.** A routine is a standing
instruction to an agent that runs unattended; a lane that could write its own `approved_at` would be
granting itself a permission nobody re-reads after the first day. So `fromProposal()` builds the
record field by field rather than spreading what the lane wrote — `state`, `approved_at`,
`approved_by`, `last_outcome` and `last_run_at` do not survive it. Same principle as
`deploy/lane/proposal-lib.mjs`, and for a longer-lived grant.

Three things the tests pin that are easy to get wrong:

- **`proposed → pause → resume` must not reach `active`.** Without an explicit refusal, pausing an
  unapproved routine and resuming it is a path to running that skips the founder entirely.
- **A weekly routine must not be starved by an hourly one.** Dispatch is longest-waiting-first, so
  the routine that is due on every sweep cannot hold the slot forever.
- **A corrupt `last_run_at` must not retire a routine.** An unreadable timestamp lets it run rather
  than wedging something the founder approved, silently, for good.

### Reading them back (second piece)

Routines live beside the run reports on the venture repo's `foundry-state` ref — the same ref
deliberately, because a routine and the report of it running are one story, and a founder asking
"did the Monday routine do anything?" should not need two places to look.

`fromStored()` is the reading half of the write-side stripping above, and it has the harder job:
restore an approval the studio recorded, without letting a file **claim** one. That ref is writable
by the lane, so `state: "active"` with no `approved_at` behind it is read back as `proposed` and the
routine does not run. Both halves of the approval are required; one without the other is not a grant.

Listing is ordered by what needs the founder: proposed first, then active, then paused.

## What is left, in order

1. **The studio surface** — routines listed with state, cadence, why-not-running, and last result
   (reads FB-042), plus approve / pause / run-now, in the same shape as the approve action so a
   founder learns one pattern for agreeing to things.
2. **The box** — the lane proposes a routine; the scheduler reads approved ones and honours
   `nextToDispatch`. This deploys separately, like every other box-side change.

## Verification
`/review` + live: a proposed routine appears, is approved, runs on cadence, and is pausable.
