# FB-047 — Agent-proposed routines (fully apply meridian's routines + Cofounder parity)

**Status:** In progress — the model is in, the surfaces are not · **Phase:** 3 · **Depends on:** FB-040 (scheduler), FB-042 (RunReports) · **Repo:**
fountainbridge (+ venture VM) · **Branch:** `fb-047-agent-proposed-routines` · One ticket = one branch = one PR.

**Shipped in part:** the routine model (#125), the storage/reading half (#126) and the studio
surface (#127). Still to come: the box-side scheduler that reads approved routines, and the lane
side that proposes one. A founder can now see and control a routine; nothing yet creates or runs
them, so this ticket is not done.

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

### The surface (third piece)

`/venture/<id>/routines` — each routine with its state, its cadence, the standing order, the "only
when" test, how it went last time, and **why it is not running right now**. That last line is the
one the page exists for: "nothing is happening", "paused by you" and "ran an hour ago" are three
different facts that look identical on a list.

The decision action is deliberately the same shape as the approve action (FB-046/058) — session,
venture, repo allowlist, re-read what is true now, pinned sha — so a founder learns one pattern for
agreeing to things. It is **not** HMAC-signed, and that is a considered difference rather than an
omission: a signed grant authorises a separate executor to do something irreversible outside the
company. Approving a routine authorises the lane to keep doing what it already does, on a cadence,
and the external actions inside a routine still gate individually every time through that same
signed path. Signing here would imply a guarantee this action cannot make.

Reachable from the venture board, beside "See what your venture knows", rather than as a fifth item
in the navigation FB-067 cut to four. A page nobody can reach is the same as no page.

## What is left

**The box.** The lane proposes a routine; the scheduler reads the approved ones and honours
`nextToDispatch` with its cooldown. This deploys separately, like every other box-side change —
and until it lands, nothing creates a routine and nothing runs one.

## Verification
`/review` + live: a proposed routine appears, is approved, runs on cadence, and is pausable.
