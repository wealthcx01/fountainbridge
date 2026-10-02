# FB-239 — one machine per agent per ticket, with the skills it used on the record

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"should it not be one temp VM on
railway per pixel agent, per ticket that is being worked, with the right skills files loaded to tackle the
ticket? and we should be able to see what skills each worker used"* · **Depends on:** FB-228, FB-231 ·
One ticket = one branch = one PR.

> **Shipped in part.** PR #296 landed **the ruling only** — a character means a piece of work, helpers
> invisible — and closed design gap 3 with it. **None of the build has started**, and it deliberately
> cannot until the preview link arrives (FB-228, FB-230) and the office can see a worker that is not on
> the venture's machine (FB-231).
>
> Recorded this way rather than left at `filed`, because the commit that carried the ruling names this
> ticket and `ticket-drift` is right to notice. A decision landing is not the work landing.

## Shipped 2026-10-02: the machine itself — made, given only what it needs, and always destroyed

**Shipped in part:** the temporary machine is built and proved against a stand-in provider, but no real machine has ever been made, the office cannot yet draw a worker on one (FB-231 item 3), and the isolation test D11 requires has not been written. Switching it on needs a Hetzner token and a spending cap from John (`docs/ticket-machines.md`).

**What was built.** When the venture's lane picks a ticket and `TICKET_MACHINES=on`, it no longer works
the ticket in place. It makes a machine for that ticket, sends it only the lane's scripts and this
venture's credentials over a key made for that one run, runs the same `supervisor.sh` there, brings
back whether the run finished, which guides it followed and its session list, and destroys the machine.
It is **off by default**, so nothing on any venture changes until someone switches it on.

| file | what it does |
| --- | --- |
| `deploy/lane/machine-lib.mjs` | the lifecycle, the caps and the clean-up, with no network in it |
| `deploy/lane/machine-hetzner.mjs` | the Hetzner provider: create, wait, list ours, destroy |
| `deploy/lane/machine-ssh.mjs` | a key per run; files and credentials go over the connection, never a command line |
| `deploy/lane/ticket-machine.mjs` | `run` (called by `run-once.sh`) and `reap` (called by the timer) |
| `deploy/lane/worker-run.sh` | what runs on the machine: fetch the one repo, run the supervisor, write the result |
| `deploy/lane/foundry-ticket-reaper.{service,timer}` | the clean-up job, every ten minutes |
| `docs/ticket-machines.md` | why Hetzner, the cost per run, and the three things that switch it on |

**Why it cannot be left running.** Three separate things end a machine: the run destroys it whatever
happens (and finds it by label if the create reply was lost); the machine switches itself off at its
deadline; and the clean-up job asks Hetzner — not a file — for every ticket machine and destroys each
one past its deadline. A machine lives at most about three hours.

**Why Hetzner.** The venture machines are already there (D1), the lane needs a whole machine rather than
an app container, and Hetzner bills by the hour and stops when the machine is deleted. A typical
ticket costs one to two euro cents of machine time; the budget counts every run at its worst case of
six cents, with a default cap of €1.00 a day.

**Tested against a stand-in, not a real account.** 39 tests: a whole run; a crash mid-run, a failed
delivery, a lost create reply and a run that leaves no result all still end with the machine destroyed;
a run killed outright is caught by the clean-up job once past its deadline and not before; the
clean-up never touches a machine without the ticket-machine label; two tickets at once get two
machines and neither receives the other's token or files; no secret is put in the start-up script the
provider keeps.

## The shape John is describing

One ticket, one temporary machine, one character in the office, the right skills loaded for that kind of
work, and afterwards a link to the result and a record of what the worker used.

**It is the right shape.** It makes the office an honest picture of the company rather than of the runtime,
it stops tickets contaminating each other, and it answers "what is happening right now" with something a
founder can actually look at.

## What has to be true first, and none of it is optional

Three things, all already written up, and this ticket is the one that assembles them:

1. **A preview link that arrives** (FB-228, FB-230). Currently blocked on a single GitHub permission. Without
   it a temporary machine produces work nobody can see, which is worse than working on the box.
2. **An office that can see a worker that is not on the box** (FB-231). Today the office draws a character
   per Claude transcript **file on the venture's own machine**. A worker on a temporary machine writes its
   transcript there, so it would be **invisible** — and the office would show an empty room while work was
   happening. That is worse than the crowded room FB-218 just fixed.
3. **A record of what a worker loaded** (FB-231). The office stores eight facts per character and the run
   report stores nine; neither has room for skills. It is not hidden, it is **never written down**.

**So this ticket is deliberately last.** Doing it first would break the one screen that tells a founder the
factory is alive.

## RULED by John, 2026-09-30: one machine and one character per ticket, helpers invisible

*"one machine and one character per ticket, helpers invisible."*

So a character means **a piece of work**, not an agent and not a department. A wake that spawns eight
subagents shows **one** character, because eight would make the room a picture of how the runtime
parallelised rather than of what the company is doing — the objection FB-218 raised.

Three consequences, and they are what this ticket builds to:

- **The unit is the ticket.** One temporary machine, one character, one preview link, one entry in the
  record. Anything the worker spawns inside itself is its own business and is never drawn.
- **FB-218's bound still has to hold.** A character appears while its ticket is being worked and is gone
  when it stops. That is easier under this ruling than the old one, because there is one thing to track
  per ticket rather than a fluctuating count of subagents.
- **This closes design gap 3.** `docs/design-gaps-open.md` asked whether a figure means an agent, a
  department or a piece of work. It means a piece of work. The gap moves to Closed with this date.

## Scope

1. The lane's claim stays on the persistent machine. It is a git branch-create compare-and-set, which
   already works across machines and is what stops two workers taking the same ticket.
2. The **work** moves to a machine that exists only for that ticket, then is destroyed.
3. Skills are chosen by the ticket's kind — the surface it belongs to, whether it touches a screen, whether
   it is sensitive — and the choice is **recorded**, not just made.
4. The office draws one character for that worker, live, and it disappears when the work ends.
5. The ticket's trail carries the preview link and the skills used.

## What stays on the persistent machine, and why each cannot move

| stays | why |
|---|---|
| the approval record | must never be lost; FB-071 and FB-072 put it where the lane cannot author it |
| the venture brain | re-indexing cost 415 files and 160 seconds here — per ticket is absurd |
| the office socket | a founder watching needs something to watch between wakes |
| the composer | the plain door for a founder who never opens Claude Code (D10) |

## Out of scope

- FB-228, FB-230 and FB-231. This depends on them; it does not contain them.
- The free Railway VM. Its own published limits rule it out: three machines per address per day, 2 GB of
  memory where ARCA uses 1.9 GB at rest, deleted after 24 hours.
- Ruling what a character means. That is the design gap above and it comes first.

## Acceptance criteria

- [ ] A ticket is worked on a machine that did not exist before it and does not exist after. **Built and
      proved against a stand-in provider (2026-10-02); no real machine has been made yet.** It is met when
      one real ticket has been watched going through.
- [ ] Its character appears in the office while it works and is gone when it stops — and an empty office
      still means nothing is running. **Not started.** Needs FB-231 item 3; the worker's sessions are
      already brought back and added to the venture's index, marked with the machine.
- [ ] The founder can click through to the result. The pull request link works as today; the running
      preview still waits on FB-230.
- [ ] The trail says which skills the worker used, in words, without the founder needing to know what a skill
      is. **In code, not yet seen:** the worker runs the same `write_runreport`, which reads its own
      transcripts (FB-231), so the run report should carry them. Unverified until a real run.
- [ ] Two tickets can be worked at once without either seeing the other's files. **The machines are
      separate and a test proves neither receives the other's token or files**, but the venture's
      one-wake lock still allows one ticket at a time.
- [x] Nothing in the four persistent things above moved. The approval record, the brain, the office
      socket and the composer stay on the venture's machine; none is sent to a worker.
- [ ] The cross-venture isolation test D11 requires lands **before** this ships, not after. A temporary
      machine holds a credential, and a test must prove that credential reaches exactly one venture.
      **Not written.** The worker holds exactly the venture's own GitHub token and nothing else, so this
      test is the same as narrowing that token (`docs/venture-github-token.md`). Must pass before the
      switch is turned on.

## Verification

The office is a screen, so non-negotiable 11 applies in full. And the real verification is watching one real
ticket go through: a character appears, work happens, a link works, the character goes, the machine is gone.
Anything less is a pipeline nobody has seen run.
