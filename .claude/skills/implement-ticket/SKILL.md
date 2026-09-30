---
name: implement-ticket
description: Build a filed ticket to completion, one committed pass at a time, without handing back after the first green commit. Use when working a ticket from docs/tickets/ through to a merged pull request. Adapted from dzhng/skills implement-spec.
---

# Implement a ticket

Adapted from `engineering/implement-spec` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

## The rule it exists for

> A pass is a **commit checkpoint, not a stopping point.** The job is the whole ticket — every criterion —
> not the first green commit. Finishing a pass means starting the next one, not handing back.

Stop only when the ticket is fully met, or when a genuine blocker needs a decision only the founder can
make. **"I have done the first part, shall I continue?" is not a blocker.**

## The loop

1. **Read the ticket, then read the code it names.** Acceptance criteria are the contract; the ticket's
   scope wins over any plan for what ships in this pull request.
2. **Work the branch the ticket names**, `fb-XXX-slug`, and only that ticket.
3. **Make each change verifiable before moving on.** A pass that cannot be checked is a pass you will have
   to redo.
4. **Run the gates as you go**, not at the end: `npm run lint`, `npm run typecheck`, the unit tests,
   `make parse-tickets`, `make copy-lint`, `make ticket-drift`.
5. **Tick criteria as they are genuinely met**, and where one cannot be met, say so in the ticket rather
   than leaving it looking done.

## The checks this repository learned the hard way

**Delete the fix and watch the test go red.** Every new guard, every time. Five tests here have passed while
measuring nothing, and this is the only check that found any of them. If it stays green, it was never a
test.

**Print where you landed beside every reading.** A timing measurement that redirected to a sign-in page
merged once. Record the URL, the height, the count — whatever the reading is *of*.

**Look at the screen beside its design** if anything renders (non-negotiable 11). Run
`scripts/visual-parity-diff.mjs` and then **look at the pictures**. A screen can be entirely correct and
completely unusable.

**Read the failure, do not re-run it.** A red check that seems unrelated is either a real fault or a known
flake, and the difference is worth two minutes. Merging past a red check is how a required gate stops being
believed.

## Memory is a tool, not a formality

Before reaching for grep: `gbrain search "<terms>"` for meaning, `gbrain code-def <symbol>` for a
definition, `gbrain code-callers <symbol>` for who calls it. Grep is right for an exact string.

## Finishing

A ticket is finished when its criteria are ticked or explicitly un-tickable with the reason stated, the
gates are green, and the pull request body says what changed, what was measured, and what was **not**
verified. **Say what you did not check** rather than implying you checked it.

Then `close-ticket`.
