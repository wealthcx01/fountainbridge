---
slug: gbrain
title: gbrain
order: 4
summary: Durable memory the lanes and the studio draw on — partitioned per venture.
---

## Memory that outlasts a session

An agent's conversation ends; the venture doesn't. **gbrain** is the durable memory the lanes and the
studio write to and read from — the place decisions, context, and hard-won lessons are recorded so
they survive across sessions and don't have to be re-explained every morning.

## What goes in it

The useful, non-obvious things a good teammate would remember:

- **Decisions** and the reasoning behind them, so choices aren't silently reversed later.
- **Context** that isn't derivable from the code — why something is the way it is, what was tried and
  rejected, what a stakeholder actually wants.
- **Cross-session threads** — where a piece of work stands, so the next lane picks up cleanly.

It deliberately does *not* store what the repository already records (code structure, history) — memory
is for what code can't tell you.

## Partitioned per venture

gbrain is scoped **per venture**. Your venture's memory is its own; it isn't pooled with another
founder's. That keeps the isolation promise consistent all the way down — separate boxes, separate
data, separate memory — and it means the studio can safely draw on gbrain for context without ever
leaking one venture's thinking into another's.

## Never secrets

One firm line: credentials and secrets never go in gbrain (or in tickets, or in code). They live only
on the venture's own box and deployment environment. Memory holds knowledge, not keys.
