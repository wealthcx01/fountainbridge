---
name: audit-choices
description: Audit the decisions an agent made on its own, rather than its diff. Use before merging work the lane implemented, when integrating a delegated pass, or when a fix works but might be a point fix. Changes no code. Adapted from dzhng/skills audit-choices.
---

# Audit the choices, not the diff

Adapted from `engineering/audit-choices` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> Given a good decision, an agent implements it faithfully; **wherever the task is underspecified, it makes
> the decision itself — silently, and the diff won't flag it.** Reviewing thousands of changed lines
> doesn't scale, and it inspects the execution, which was probably fine.

## Why this one matters more here than almost anywhere

**This is the risk of an autonomous factory, named.** The lane picks up a ticket and runs plan, implement,
validate, review and QA without a person in the loop. Every one of those stages meets a question the ticket
did not answer, and answers it. The code works. The pull request is green. **And the venture now has
architecture its founder never chose.**

"Keeping the founder in the loop" cannot mean reading every diff — no founder will, and the ones who would
are not the ones we are building for. It means **surfacing the decisions**, which is a short list a person
can actually judge.

## The audit

1. **Trace the session, not the diff.** What was the ticket silent about? Every silence is a place a
   decision was made.
2. **List the choices**, each in one line a founder could understand: what was decided, what the
   alternatives were, and whether it is reversible.
3. **Mark each one:** settled by the ticket · settled by an existing rule · **chosen by the agent**.
   Only the third kind needs anyone's attention.
4. **Judge the third list.** Is it what the founder would have chosen? Is it consistent with the
   non-negotiables? Does it quietly create a second copy of something (see `refactor-clean`)?
5. **Record the verdicts.** A choice nobody objected to is still a choice somebody should be able to find
   later — that is what `docs/tickets/` and the phased plan's decision list are for.

## It changes no code and blocks nothing

This is an audit, not a gate. It never stops an unsupervised run. Its output is a list, and a list that
arrives after the fact is still worth having — **this project has twice discovered a diagnosis was wrong
only because somebody went back and read what had been decided.**

## What to be most suspicious of

- **A point fix that works.** The question is not whether it works; it is whether the same bug exists three
  more times.
- **A new abstraction nobody asked for.** Especially one that sits beside the old one rather than replacing
  it.
- **A silently narrowed scope.** The ticket asked for X, the code does most of X, and the gap is nowhere
  stated. This is the failure that most resembles success.
