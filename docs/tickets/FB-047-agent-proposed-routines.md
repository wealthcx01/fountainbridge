# FB-047 — Agent-proposed routines (fully apply meridian's routines + Cofounder parity)

**Status:** In progress — the model is in, the surfaces are not · **Phase:** 3 · **Depends on:** FB-040 (scheduler), FB-042 (RunReports) · **Repo:**
fountainbridge (+ venture VM) · **Branch:** `fb-047-agent-proposed-routines` · One ticket = one branch = one PR.

**Shipped in part:** the routine model (#125), storage/reading (#126), the studio surface (#127)
and the box-side firing (#128). Still to come: **deploying it to a box** — lane files reach a box by
hand — and the lane *proposing* a routine of its own. A founder can see, approve, pause and resume a
routine, and an approved routine files its work on cadence once the box has the runner.

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

### The box (fourth piece)

`routines-fire.mjs` runs once per wake, **before** the ticket scan. A routine the founder approved
keeps its cadence whether or not the backlog is busy — otherwise a weekly commitment is starved
forever by a queue that is never empty, which is the opposite of what approving it meant. Firing is
one API call and no model session; the ticket it files is then worked through the ordinary queue,
with the same claim, budget, circuit breaker and founder accept.

**A routine files a ticket. It does not do the work.** Git is the source of truth for work items, so
recurring work enters the queue like everything else — otherwise it would be a second, ungoverned
path to changing a venture and every safeguard would have to be built twice.

`routines-lib.mjs` duplicates the dispatch logic rather than importing `lib/routines.ts`, on
FB-097's precedent: this ships to the box and the studio ships to Railway, and a shared import
across that boundary is a build-time coupling between two things that deploy separately. The
duplication is pinned — `__tests__/routines-lib.test.mjs` asserts the same behaviours as
`lib/__tests__/routines.test.ts`, including that an approval a *file* merely claims is refused,
which matters more on this side because this is the code that would act on it.

Firing is non-fatal by design: the wake's real job is the backlog, and a routine that cannot fire is
a line in the log, not a reason to skip work already waiting. But a **missing** runner logs loudly
rather than skipping quietly — an approved routine that never fires because the file was not copied
would otherwise look identical to a routine with nothing to do, which is the failure this lane has
now met three times (FB-112, FB-113, ARCA-34).

## What is left

1. **Deploy it.** `routines-fire.mjs` and `routines-lib.mjs` are not on any box. Lane files are
   copied by hand — the same gap FB-113 fixed for the LibreChat side and has not fixed here. Until
   they are copied, the wake logs that routines will not run.
2. **The lane proposing one.** Nothing yet writes a proposal, so every routine today has to be
   created by hand. The mechanism accepts them; the judgement about *when* to suggest one is a
   model-side change and is the honest remainder of "agent-proposed".

## Verification
`/review` + live: a proposed routine appears, is approved, runs on cadence, and is pausable.
