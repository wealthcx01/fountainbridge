# FB-224 — replan the architecture: Claude Code is the workbench, Foundry is the ledger

**Status:** filed · **Phase:** 3 · **Raised by:** John, 2026-09-29 at the mid-project check-in —
*"I think we need to replan the architecture"* · One ticket = one branch = one PR.

## What this ticket is

A **decision** to be ruled on, not work to be done. It carries
`docs/architecture-replan-2026-09.md` into the repo as a proposal and asks John to rule on four new
decisions and one amendment to a binding one.

Filed with its document in the same commit, because a decision record whose deliverable is the record
trips `make ticket-drift` when filing and shipping are separate — that lesson is written into FB-220 and
this is the first ticket to apply it.

## What is proposed

- **D10 — Claude Code is the workbench; Foundry is the ledger; the composer is the front door.** Build
  the `foundry-studio` MCP server. It reads, files and **proposes**, and it can never grant an approval,
  because that would create a second signing surface invisibly on a device while FB-183 is establishing
  there is exactly one. Collapses FB-144.
- **D11 — amend D1.** One VPS per venture stops meaning one machine does everything: ephemeral per-ticket
  build environments, a small persistent spine for the office, the approval record and the brain. Takes
  the shape John asked for while rejecting the free-VM product as the mechanism, on its own published
  limits.
- **D12 — agents load skills.** Adopt four from `dzhng/skills`, starting with the one that was not on
  the list: `compare-screenshots`, which is non-negotiable 11 with a mechanism instead of a sentence.
- **D13 — memory is state or event**, dated by a script rather than a sentence, with an append-only check
  and a golden question set.

Two things are deliberately left un-ruled: Sell (waits on a changed password and an approved scrape) and
`duet-agent` (read, do not adopt).

## Why now

Three things arrived together and point the same way: John's own instinct about per-ticket environments,
two independent pieces of feedback that converge on the MCP server, and this session's own evidence —
ARCA at 83% disk, a room drawing 120 finished agents, and a ticket that said `filed` after its work
shipped, twice.

## Scope

1. `docs/architecture-replan-2026-09.md` in the repo, marked **PROPOSAL**.
2. Nothing else. No code, no dependency, no box change, and **no other ticket re-cut until John rules** —
   because eight tickets written against an unapproved architecture is eight tickets to rewrite.

## Out of scope

- Implementing any of D10–D13. Each becomes its own ticket, in the order the document sets out.
- Retiring the composer. The ruling retires it as a *first-class surface*; it stays as the plain door, and
  the deletion is not on the table.
- The Decile Hub scrape. Blocked on a changed password and an explicit approval, both named in the
  document.
- FB-183. This document depends on it landing and does not change it.

## Acceptance criteria

- [ ] The document states each ruling with what it costs and what would not be waved away, in English a
      non-technical reader can follow.
- [ ] It names where it disagrees with the feedback and with John's framing, in the ruling rather than a
      footnote — specifically that the Railway free VM is the wrong mechanism, and that `renderer` is a
      GPU architecture guide rather than a Scale capability.
- [ ] Every claim about an outside product carries what was actually checked on 2026-09-29, including
      where it undercuts the proposal.
- [ ] It is marked PROPOSAL and says plainly that nothing binds until John rules.
- [ ] The two design gaps are written down for Claude Design rather than guessed at.
- [ ] `make ticket-drift` passes with the document and this ticket in the same commit.

## Verification

Documents only. No screen changed, so non-negotiable 11 does not apply — said here rather than left
blank.
