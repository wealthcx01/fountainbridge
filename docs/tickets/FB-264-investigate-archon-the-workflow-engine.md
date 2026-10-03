# FB-264 — investigate Archon, now a workflow engine for AI coding: does it make the Foundry better for founders?

**Status:** Todo · **Phase:** 3 · **Raised by:** John, 2026-10-03 — *"add this as a new investigation
ticket — https://github.com/coleam00/Archon. Will this improve experience and capabilities of founders
using the Foundry?"* · **Kind:** investigation (a decision, not a build) · One ticket = one branch = one PR.

## What Archon is now (read 2026-10-03)

Archon is Cole Medin's project, MIT-licensed, written in TypeScript on Bun, about 23,600 stars, changed
the day this was written. **It is not the Archon this repo studied.** The version mapped in
`docs/jstack-bruntsfield-method.md` — a task board and a searchable knowledge base for coding
assistants — is archived on its `archive/v1-task-management-rag` branch.

Today Archon is **a workflow engine for AI coding agents** — "a harness builder". A team writes its
development process as a file in the repository (`.archon/workflows/*.yaml`): plan, build, run the
tests, review, wait for a person's approval, open the pull request. Archon runs it the same way every
time. Its own words: "the AI fills in the intelligence at each step, but the structure is
deterministic and owned by you."

What it offers, from its README:

- **Steps that are either AI or plain commands.** A test run is a command, not a model's choice.
- **Loops with a stopping rule** ("until all tasks complete", with a fresh session each time).
- **A pause for a person** (an interactive approval step) before anything goes on.
- **Each run in its own copy of the code** (a git worktree), so several run side by side.
- **Ready-made processes**: fix a GitHub issue end to end, review a pull request with several agents,
  write a product brief through a guided conversation (`archon-interactive-prd`).
- **Ways in**: a command line, a web console, Telegram, Slack, Discord and GitHub.
- **A record of every run** in SQLite or Postgres.
- **Telemetry on by default**: it sends anonymous usage events unless switched off.

## Why this is worth an investigation, not a yes or no today

Most of what Archon does, the Foundry already does a hand-built way:

| Archon | The Foundry today |
|---|---|
| A process written as a workflow file | The lane's process written as shell scripts (`deploy/lane/run-once.sh`, `supervisor.sh`): research, plan, build, check, review, test, open a PR |
| Each run in its own worktree | One worktree per venture box; one machine per ticket built but switched off (FB-239) |
| An interactive approval pause | Signed approvals and the ActiveGraph gate (FB-171, FB-183): a record a lane cannot forge |
| A guided product-brief conversation | The composer and the founding map (FB-236) |
| Telegram and Slack | The pocket studio, push notifications and voice notes (FB-141, FB-179, FB-173) |
| A record of every run | Run reports on each venture's state branch |

So the question is not "should we have these things" — we do. It is whether Archon would make them
**more reliable, faster to change, and better for a founder** than the scripts we maintain ourselves.

## Where it could help founders

1. **Work that comes back the same way every time.** A founder cannot read code. What they can judge
   is whether the team's work is consistent. A process written down as steps, with the checks as
   plain commands, is easier to make dependable than shell scripts that have grown for two months.
2. **A founder could see, and one day shape, how their team works.** A workflow file is short and
   readable. "Plan, build, test, ask me, open it" is something a founder could read on the studio's
   screen, unlike `supervisor.sh`.
3. **Ready-made processes we do not have**: a several-agent pull-request review, and fixing a reported
   bug from the issue to the pull request.
4. **Faster for us to change.** A new step for every venture becomes an edit to one file, not a change
   to shell scripts copied to each box (the path that left box files out of date for weeks).

## Where it could hurt, and must not

- **The approval gate.** Archon's approval is a pause in a running process. Ours is a signed record
  checked before anything leaves the company (non-negotiable 4). Archon must never be the thing that
  sends, spends or deploys; it may only ever hand work to our gate.
- **Venture isolation** (D1, non-negotiable 6). One Archon per venture, never one serving several.
- **Telemetry.** Off on every venture box, before the first run.
- **A young project changing daily.** Pin a version; read the change log before moving.
- **Replacing something that works.** ARCA's lane is shipping again (FB-251). A switch has to beat it on
  the same tickets, not on paper.

## Scope — what this investigation does

1. Read Archon's code where it matters to us: the workflow format, how a run is isolated, where it keeps
   credentials, what telemetry sends, and how an approval step works. Note the version read.
2. **Run it for real, sandboxed, not on a venture box.** Write one Archon workflow that mirrors ARCA's
   lane (research, plan, build, test, review, open a PR — with no external actions at all) and run it on
   two or three real ARCA tickets, in a scratch copy of the repository, against a test branch.
3. **Compare with ARCA's lane on the same tickets**: did it finish, how long it took, what it cost in
   model time, and how good the pull request was (passed its checks, passed review).
4. Look at whether a founder could read a workflow on the studio's screen, and what that would take.
5. **Write a recommendation** in plain English, one of: adopt it as the lane's engine (with a migration
   plan as tickets), borrow specific ideas into our own lane (named), or leave it.

## Out of scope

- Installing Archon on any venture box, or letting it touch production. Any of that is a later ticket,
  after John decides.
- Its chat adapters for founders. The pocket studio is the founder's phone surface; this does not add
  a second one.

## Acceptance criteria

- [ ] Archon's workflow format, isolation, credential handling, telemetry and approval step are
      described from its code, with the version read.
- [ ] One workflow mirroring ARCA's lane ran on at least two real ARCA tickets, sandboxed, with no
      external action possible.
- [ ] The same tickets are compared against ARCA's own lane on completion, time, cost and pull-request
      quality, with the numbers.
- [ ] A written recommendation — adopt, borrow, or leave — with the reasons, and the follow-up tickets
      it implies.
