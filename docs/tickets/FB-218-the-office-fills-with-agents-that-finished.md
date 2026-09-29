# FB-218 — the office fills with agents that finished days ago

**Status:** Shipped in part · **Phase:** 3 · **Found by:** John, looking at the office, 2026-09-23

> **Done.** PR #279 shipped the diagnosis and a restart. This second PR ships the bound, measured
> against the real room on ARCA: **120 figures became 0**, because nothing had run on that machine for
> over two hours. All three acceptance criteria are met.
>
> **One thing in the original diagnosis was wrong, and it matters.** FB-218 and the memory note blamed
> `watchAllSessions: true`. The office's own `settingsLoaded` message reports it as **`false`** while
> the room still held 120 agents, so that flag was never the cause and turning it off would have
> achieved nothing — it was the option most likely to be tried first, and it would have risked a
> permanently empty office for no benefit. The real cause is simpler: the lane opens a new session per
> wake and pixel-agents never removes one.

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

## What was measured on the box, 2026-09-29

Six days after the restart of 23 September, on the real ARCA machine:

| | |
|---|---|
| agents in the registry | **120** |
| transcripts written in the last 5 minutes | 0 |
| in the last 2 hours | **0** |
| 2–24 hours | 20 |
| over 24 hours | 100 |
| session files on disk | 1,263 (was 1,227 on 23 September) |

So the room was drawing **120 figures over a machine where nothing had run for two hours.** That is
not a crowded room, it is the board lying, which is the failure non-negotiable 10 exists to forbid.

### Why there was nothing to reap by

Three things had to be established before a fix could be written, and two of them killed the obvious
approaches:

1. **The agent record has no status and no timestamp.** It carries `id, sessionId, terminalName,
   isExternal, jsonlFile, projectDir, palette, hueShift`. pixel-agents has no concept of an agent
   ending, so there is nothing in its registry to reap *by*.
2. **Its own `agentStatus` message is no help.** All 120 agents reported `waiting`, including the
   hundred untouched for over a day. `waiting` is its resting state for everything, not a claim about
   liveness.
3. **`watchAllSessions` was not the cause** — see the correction above.

The one truthful per-agent signal on the box is that **a session writes to its `.jsonl` while it works
and stops the moment it ends.**

## How it is bounded

The bound runs in **our gate**, `deploy/office/office-gate-lib.mjs`, not in pixel-agents — because
`provision-office.sh` reinstalls that package at a pinned version and anything edited inside it is
overwritten on the next provision. The gate is ours and is already the only thing between a browser and
this machine.

- `liveRoster()` filters the office's `existingAgents` message: an agent whose transcript has not been
  written within `LIVE_WINDOW_MS` (30 minutes) is left out, along with its entries in `agentMeta` and
  `externalAgents`.
- `forwardToBrowser()` withholds `agentStatus` / `agentContextUsage` for agents the browser was never
  told about. Without this the room refills itself one message at a time, which would have looked like
  the bound failing at random.
- **It fails towards showing.** An agent with no transcript recorded, or an unreadable registry, keeps
  every figure — because an empty office over a working machine is the worse lie.

Thirty minutes is generous on purpose: a lane round can sit inside one long model call, and a founder
must never watch a working agent vanish. This bounds a room that reached 120; precision is not what it
is for.

### Proof it reads real file times rather than always answering zero

Same real registry, same real files, only the window changed:

| window | figures drawn |
|---|---|
| 30 min (shipping) | 0 |
| 2 hours | 0 |
| 24 hours | 20 |
| 7 days | 120 |

And nine tests, each checked by breaking the code on purpose: removing the filter fails three of them,
forwarding per-agent news unconditionally fails one, and leaving stale metadata behind fails one.

## Design gap for Claude Design

**This fix makes an empty office a normal state, and nobody has decided what an empty office should
look like.** Today the room simply has no one in it. When the lane is idle — which is most of the time
between wakes — that is now what a founder sees.

That is the honest answer and it may not be the right *picture*. It is the same question the fourth
option in this ticket raised from the other end: the design's line is *"each character is 1 agent on
Arca's machine"*, written when that meant a handful. Two things worth a ruling:

1. What the room shows when nothing is running. An empty room, a resting state, or a line of copy?
2. Whether a figure should mean an agent at all, or a department, once a wake can spawn eight.

Not blocking this PR — the bound is right either way, and the second question changes what is drawn,
not whether it is bounded.

## Related

FB-162 — a venture's state ref grows forever. Same shape: something accumulates per wake with
nothing to bound it, and it is only noticed when a screen becomes unusable.

## Acceptance criteria

- [x] The office holds fewer than ten figures in normal use, a day after any reset.
      *(Measured on the real room six days after a reset: 120 → 0. The count is now bounded by how
      many agents are working at once, not by how long the machine has been up.)*
- [x] It is never empty while the machine is working.
      *(A working agent is writing its transcript, so it always passes. The filter fails towards
      showing: no transcript recorded, or an unreadable registry, keeps every figure. Tested.)*
- [x] Whatever bounds it is stated where somebody will find it, not left to a restart nobody schedules.
      *(`LIVE_WINDOW_MS` and `liveRoster()` in `deploy/office/office-gate-lib.mjs`, with the three
      measurements that ruled out the alternatives written beside them.)*
