---
slug: tickets
title: Tickets, branches, PRs
order: 2
summary: The unit of work — and why an agent never merges its own change.
---

## One ticket = one branch = one PR

All work is cut into **tickets** — a short markdown file describing one change, small enough to read
and reason about. Every ticket follows the same path:

1. **Ticket** — the change is written down first (`docs/tickets/FB-XXX-slug.md`): context, scope,
   what's explicitly out of scope, and how it'll be verified.
2. **Branch** — a lane does the work on its own branch named for the ticket. Nothing touches the main
   line yet.
3. **Pull request** — the finished work opens as a PR: a reviewable diff, with automated checks
   (lint, types, tests, a screenshot gallery of the UI) attached.

One ticket, one branch, one PR. No lane bundles unrelated work together, and discovered work becomes
a *new* ticket rather than sprawling the current one.

## The lane never merges

This is the rule that makes the speed safe: **a lane opens a PR and stops.** A human merges, per the
approval matrix. So the agents can move as fast as they like — the worst they can do is propose a
change, which someone reads before it becomes real.

## Git is the record

The studio has no separate database of your tickets or work items. It reads `docs/tickets/` and the
pull requests **directly from the venture's repositories** and renders them. That's deliberate: there
is one source of truth, git, and the studio is a live view and a set of controls on top of it — never
a second copy that can drift out of sync with reality.
