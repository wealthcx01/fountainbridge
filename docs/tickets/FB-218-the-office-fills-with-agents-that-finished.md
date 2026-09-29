# FB-218 — the office fills with agents that finished days ago

**Status:** Shipped in part · **Phase:** 3 · **Found by:** John, looking at the office, 2026-09-23

> **Shipped in part:** PR #279 shipped the diagnosis and a restart. **None of the three acceptance
> criteria below are met**, because a restart is not a bound — at ~41 sessions a day the room is back
> over ten figures within a day. What is left is choosing one of the four options below and
> implementing it, and the last of them ("show the team, not the process") is a question for Claude
> Design before it is a question for code.
>
> Recorded this way rather than as Done because the board a founder reads is built from these lines. A
> ticket marked Done over a screen that still fills up is the board lying, which is the failure
> non-negotiable 10 exists to forbid.

## What a founder sees

A room packed with idle figures. John: *"the pixel agents office is absolutely full of idle agents."*

Almost none of them are doing anything. Most finished days ago.

## Why

Three facts, each fine on its own:

1. **`/root/.pixel-agents/config.json` says `{ "watchAllSessions": true }`.** Every Claude session
   that produces an event becomes an agent in the room — not only the lane's current work.
2. **Nothing removes an agent.** The package has `pruneExpired`, but it prunes an *event buffer*,
   not the agent registry. An agent stays in the room for the life of the process.
3. **The process had been running for 11 days and 15 hours**, and the lane leaves **~41 session
   files a day** — measured: 1,227 files, 274MB, and 40–42 new ones on each of the last six days.

So the room accumulates every agent the machine has ever run, and only a restart empties it.

## What was done now, and what it does not fix

`systemctl restart foundry-office.service` — the registry is in memory, so the room is empty again
and refills only with work that actually happens.

**That is a reset, not a fix.** At ~41 sessions a day it is back over ten within a day.

## The options, and the trade in each

- **Restart on a timer.** Every two hours keeps it near four. Cheap, and it blinks: a founder
  watching at that moment sees the room clear and redraw.
- **`watchAllSessions: false`.** Reads correctly — only track what we are watching — but
  `isTrackedSession()` then requires an agent to already exist for that directory, so it may track
  **nothing** and leave the office permanently empty. An empty office over a working machine is a
  worse lie than a full one, and it is the failure CLAUDE.md #10 exists to forbid. Must be tested
  against a real wake before it is trusted.
- **Spawn fewer subagents per wake.** The honest one: the room is full because the lane really does
  start that many. One figure per subagent is arguably correct and the number is the problem.
- **Show the team, not the process.** The design's line is *"Each character is 1 agent on Arca's
  machine"* — written when that meant a handful. If a wake spawns eight, the room stops being a
  picture of the company and becomes a picture of the runtime.

The last is a question for Claude Design, because it is about what the office is *for*.

## Related

FB-162 — a venture's state ref grows forever. Same shape: something accumulates per wake with
nothing to bound it, and it is only noticed when a screen becomes unusable.

## Acceptance criteria

- [ ] The office holds fewer than ten figures in normal use, a day after any reset.
- [ ] It is never empty while the machine is working.
- [ ] Whatever bounds it is stated where somebody will find it, not left to a restart nobody schedules.
