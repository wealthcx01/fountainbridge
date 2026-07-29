# FB-052 — PRP + validation loops (fully apply Cole Medin / Rasmus's PRP)

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-041 (the lane loop), FB-050 (gbrain) · **Repo:**
fountainbridge · **Branch:** `fb-052-prp-validation-loops` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The agents get the work right the first time more often, because before building they assemble the
right context and write down exactly how "done" is checked — then check it. Fewer wrong turns, less
re-work, higher-quality shipping.

## Context
The Bruntsfield Loop (`docs/jstack-bruntsfield-method.md`) puts Cole/Rasmus's **PRP (Product Requirement
Prompt: rich context + explicit validation gates)** at the PLAN step. FB-041 runs `/plan`; this ticket
makes that plan a real PRP and enforces its validation loop — Cole Medin's method, **fully applied**.

## Scope (fully applies PRP + RPIV validation)
- The PLAN step emits a **PRP**: the ticket's intent + **context gathered from gbrain** (examples, prior
  tickets, `context/`) + **explicit validation gates** ("happy path, edge cases, errors, coverage").
- **Tasks derive from the PRP** with observable acceptance criteria (the ticket scope's checklist).
- The **validation loop runs** (the PRP's gates → `/qa` + tests) before the item reaches the human gate;
  a failed gate loops back to IMPLEMENT, not forward.
- **Resume-from-the-board** property (Archon): the ticket + PRP are the durable context, so a fresh lane
  session resumes from `docs/tickets/` state without chat history.

## Out of scope
- The gstack install/loop mechanics (FB-041). The knowledge index (FB-050).

## Acceptance criteria
- [ ] A worked ticket produces a PRP (recorded in the run/RunReport or the PR) with context + validation gates.
- [ ] The validation loop gates the PR: gates fail → back to IMPLEMENT; pass → the human gate.
- [ ] A cleared/fresh lane resumes a ticket from the board + PRP alone.

## Verification
`/review` + live: a ticket's PRP is visible; a deliberately-failing validation gate loops rather than ships.
