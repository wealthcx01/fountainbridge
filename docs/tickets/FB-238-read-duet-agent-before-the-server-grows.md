# FB-238 — read `duet-agent` properly, before the MCP server grows

**Status:** Closed — the question it guarded (which agent harness to build on) is answered for the whole factory: Archon. Closed 2026-10-07 by the October re-baseline (`docs/status/2026-10-re-baseline.md`). Was: filed · **Phase:** 3 · **Raised by:** John, 2026-09-25 · **Related:** FB-200, FB-225, D9 ·
One ticket = one branch = one PR.

## What it is, and why it is not an adoption

`dzhng/duet-agent` (Apache-2.0) is *"an opinionated full-stack agent harness with native memories, long
running tasks, and multi-agent relay."*

**All three of those we have already built and dogfooded.** The lane is the harness, gbrain is the memory,
the timer plus the executor is the long-running task, and the office is the relay made visible. Adopting a
harness means replacing the spine, which is the same class of decision as `block/buzz` and gets the same
answer for the same reason (D9).

At 46 stars and a few weeks old it is also too early to put a founder's venture on.

## So why a ticket at all

Because **"we already have all three" is a reason not to adopt, not a reason not to read.** That distinction
is exactly where FB-220 went wrong first time: everything good was filed as "worth reading" and nothing was
taken, until John pushed back and three ideas turned out to be real work.

And the timing matters. Our MCP server is at seven tools of eight and will keep growing. *"Native memories
and multi-agent relay"* is precisely the territory that server sits in. **Reading someone else's opinionated
answer before we grow ours is cheap; discovering it after is not.**

## Scope

1. Read it — the README, its architecture notes, and enough of the code to see how the three headline
   features actually work rather than how they are described.
2. Write the findings into `docs/` in the shape that has worked twice now (`docs/ideas-from-meridian.md`,
   `docs/ideas-from-cole-medin.md`): **already doing / worth taking / explicitly not taking.**
3. For anything in "worth taking", **cross-reference it into the ticket that owns the work** — not into the
   decision record. That is the correction FB-220 needed and the lesson worth keeping.
4. Add a dated entry to the phased plan's D9 list so the verdict is answerable without opening a ticket.

## Out of scope

- Adopting it, or any part of its code. If that changes it changes by a PR to the plan, like every other
  decision here.
- A spike or proof of concept. A spike is how a declined dependency gets adopted anyway.
- Changing the MCP server in this ticket. Findings land as references on its tickets.

## Acceptance criteria

- [ ] The document separates what we already do from what is worth taking from what is not, and every claim
      says where it came from.
- [ ] Anything worth taking is cross-referenced into the ticket that would do the work.
- [ ] The verdict is dated. It is a young project moving fast, and a verdict with no date invites a reader to
      trust it longer than it deserves.
- [ ] Nothing is added to `package.json` and nothing changes on any machine.
- [ ] If the honest answer is "nothing here we need", the document says that plainly rather than padding a
      list to look thorough.

## Verification

Documents only, so non-negotiable 11 does not apply — said rather than left blank.
