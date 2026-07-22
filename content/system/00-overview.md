---
slug: overview
title: How a Foundry venture gets built
order: 0
summary: The machinery behind the studio — and the human gates on top of it.
---

## The whole thing in one picture

A Foundry venture is built the same way this studio was: as a stream of small, reviewable changes,
made by AI agents working in a dedicated workspace, with a human approving anything that leaves the
building. Nothing here is magic and nothing runs unattended. Every part below exists so the work is
**fast, visible, and reversible**.

The shape of it:

- Your venture gets its **own box** — a private server where the work actually happens. One venture,
  one box, no shared state with anyone else. See **Lanes on a box**.
- Work is cut into **tickets**. Each ticket becomes one branch and one pull request — a proposed
  change you (or Bruntsfield) can read before it counts. See **Tickets, branches, PRs**.
- The agents doing that work run on **gstack** — a shared pack of skills and workflows that forces a
  plan → review → ship discipline on every change. See **gstack**.
- They remember across sessions through **gbrain** — durable memory, partitioned per venture. See
  **gbrain**.
- Anything that reaches the outside world — an email, a post, a CRM write, a payment — stops at
  **ActiveGraph** and waits for a recorded human approval. See **ActiveGraph**.
- Who has to approve what is set by the **approval matrix**, and the things waiting on you surface in
  the studio's attention queue. See **The approval matrix**.

## Why it's built this way

Two rules explain almost every design choice. **Git is the source of truth** — the studio doesn't
keep its own private database of your work; it reads the same repositories the agents write to, so
what you see is what actually exists. And **nothing external happens without a human saying yes** —
the agents can draft, build, and propose all day, but the door to the outside world only opens on a
recorded approval. Speed on the inside, a firm gate at the edge.
