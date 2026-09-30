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

- [ ] A ticket is worked on a machine that did not exist before it and does not exist after.
- [ ] Its character appears in the office while it works and is gone when it stops — and an empty office
      still means nothing is running.
- [ ] The founder can click through to the result.
- [ ] The trail says which skills the worker used, in words, without the founder needing to know what a skill
      is.
- [ ] Two tickets can be worked at once without either seeing the other's files.
- [ ] Nothing in the four persistent things above moved.
- [ ] The cross-venture isolation test D11 requires lands **before** this ships, not after. A temporary
      machine holds a credential, and a test must prove that credential reaches exactly one venture.

## Verification

The office is a screen, so non-negotiable 11 applies in full. And the real verification is watching one real
ticket go through: a character appears, work happens, a link works, the character goes, the machine is gone.
Anything less is a pipeline nobody has seen run.
