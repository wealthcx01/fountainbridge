# FB-227 — the design gaps, in one place John can act on

**Status:** Done · **Phase:** 3 · **Ruled by:** John, 2026-09-29 — *"then close the design gaps"* ·
One ticket = one branch = one PR.

## What "close" means here

John's standing instruction: *"Anytime there is design gaps, please summarise what they are and I shall
address in Claude Design."* So closing a gap is not code. It is stating the question well enough that a
design decision can be made, and then getting out of the way.

They were scattered across five tickets and two documents, which is the same as not being written down.
`docs/design-gaps-open.md` collects them.

## The five

| | gap | where it came from |
|---|---|---|
| 1 | **What the desk looks like when the real work happens in Claude Code.** The biggest. The desk becomes read-mostly and the prompt bar becomes a launcher, and nothing in the artifact shows that screen. | D10, new |
| 2 | **What an empty office looks like.** FB-218's bound makes empty a normal state between wakes; an empty room could read as broken rather than resting. | FB-218, new |
| 3 | **Whether a figure should mean an agent at all**, now that one wake can spawn eight — a picture of the runtime rather than of the company. | FB-218, still open |
| 4 | **Two tokens that do not exist, used on four screens.** Cannot be fixed in code: CLAUDE.md forbids inventing a theme. | FB-150 |
| 5 | **The ledger fits a phone and cannot be read on one.** Passes the phone gate and is still unreadable. | FB-215 |

Gap 1 carries the one that matters most inside it: **how the desk serves a founder who never installs
Claude Code.** D10 keeps the composer as the plain door so the studio stays whole without it, but "whole
without it" has to be a designed state rather than a fallback nobody drew. Sell and Scale founders may
never open a terminal.

## What the code does in the meantime

Nothing, deliberately, in every case. Each gap names the honest option the code has taken and is waiting
on — the empty office is drawn empty because that is true, the desk is unchanged, the tokens are not
invented. **No gap is blocking other work**, which is why they can wait for a proper answer rather than a
quick one.

## Why gap 2 is not just tidied away

It would be easy to put something in the empty office to make it look less bare. That is the failure
non-negotiable 10 forbids arriving through decoration: a founder who reads a resting room as a working
one has been misled by an accurate screen. The room is empty because nothing is running, and what to show
instead is a decision, not a gap to paper over.

## Scope

- `docs/design-gaps-open.md`, written so a section can be taken to Claude Design as-is: what a founder
  sees today, why it is not obviously right, what a ruling would settle.
- A `## Closed` section, so a ruled gap is moved with its date and a pointer to the reading in
  `docs/design-conformance.md` rather than deleted.
- Nothing else. No screen changed.

## Out of scope

- Deciding any of them. That is the point.
- Implementing whatever is decided. Each ruling becomes its own ticket.
- FB-150 and FB-215 themselves. They stay open; this names the design question inside them so neither is
  mistaken for a code problem.

## Acceptance criteria

- [x] All five gaps in one file, each stating what a founder sees today, why that is not obviously right,
      and what a ruling would settle.
- [x] Each names what the code does meanwhile, so it is clear nothing is blocked.
- [x] Options are offered where the call is taste, without a recommendation dressed as one.
- [x] The artifact URL from CLAUDE.md #11 is in the file, so a reader has the design to hand.
- [x] A `Closed` section exists with the rule for moving a gap into it.

## Verification

Documents only. No screen changed, so non-negotiable 11 does not apply — said rather than left blank.
