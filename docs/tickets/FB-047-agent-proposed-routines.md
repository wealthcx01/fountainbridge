# FB-047 — Agent-proposed routines (fully apply meridian's routines + Cofounder parity)

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-040 (scheduler), FB-042 (RunReports) · **Repo:**
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
- [ ] A lane can propose a routine; the founder approves/pauses/runs-now in the studio.
- [ ] The scheduler runs approved routines with a cooldown; the studio shows state + last result.

## Verification
`/review` + live: a proposed routine appears, is approved, runs on cadence, and is pausable.
