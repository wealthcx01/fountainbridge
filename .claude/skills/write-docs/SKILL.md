---
name: write-docs
description: Write or revise a document as a glossary of principles rather than a mirror of the code. Use when creating or revising a README or a doc, when a doc lists things the code already holds, or when two docs overlap. Adapted from dzhng/skills write-docs.
---

# Write docs

Adapted from `engineering/write-docs` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> A doc is a **glossary**: it names the moving parts, says why each exists, and carries the principles a
> reader cannot derive by grepping. The code is the source of truth for *what exists right now* — **the doc
> must never race it.**

## The question that governs everything

**Could the reader get this faster and more reliably by reading the code?** If yes, point at the code.

A document that lists every file, flag or command is a second copy of something that changes without it,
and **a second copy is the one that drifts.** This project has already been bitten by the small version: a
comment naming a count that the code had since changed, which then made a weaker test look sufficient.

## What a document should carry

- **Why a thing exists**, which the code never says.
- **What must not break**, and what happened the time it did.
- **The decisions**, with dates, so a reader can tell whether one has gone stale.
- **Pointers into the code** for anything the code can answer itself.

## What to cut

- Lists the code already holds.
- Narrative about how something came to be, unless the how explains a constraint.
- A changelog. Git has one.
- Anything that restates a function. **If a paragraph says what a function does, cut it and name the
  function.**

## In this repository

Documents live in `docs/`, and each has one job:

| | |
|---|---|
| the phased plan | the binding decisions, D1 onwards, amended only by pull request |
| `design-conformance.md` | the readings, per screen, with dates |
| `design-gaps-open.md` | questions only a design decision answers |
| `what-john-needs-to-do.md` | what is blocked on the founder, with exact steps |
| a decision record | one evaluated thing, the verdict, and what would reopen it |

**Before adding a document, check whether one of those already owns the question.** A sixth document about
the architecture is how a reader stops trusting any of them.

Everything here is written for the founder (non-negotiable 12), including documents that look internal —
they are read by whoever arrives next, often not the person who wrote them.
