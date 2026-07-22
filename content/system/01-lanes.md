---
slug: lanes
title: Lanes on a box
order: 1
summary: One venture, one server — where the agents actually do the work.
---

## A dedicated workspace per venture

Every venture runs on its **own server** (a VPS). That box is the venture's workshop: the code, the
agent sessions, and the tools all live there, and only that venture's people can reach it. Your
founder account and John have SSH access; nothing on your box is shared with another venture, and a
session scoped to your venture can never read another's data. Isolation is enforced on the server,
not just hidden in the interface.

## What a "lane" is

A **lane** is a working agent session on the box — an AI co-founder actually doing a piece of work:
reading the repository, writing code, drafting content, running tests. Lanes run in the terminal
(inside `tmux`, so a session survives you closing your laptop) and they operate on one ticket at a
time. When a lane finishes a ticket it opens a pull request and **stops** — it never merges its own
work.

## Why a whole box, not just a chat window

Because real venture work is more than a conversation. An agent needs to run your actual build, hit
your actual test suite, hold long-lived state, and pick up where it left off tomorrow. A dedicated
box gives it a real, persistent place to do that — and gives you a clean boundary: everything the
venture is made of sits in one isolated, inspectable place you control.

The studio you're reading this in is the **window** onto that box. You don't have to live in a Linux
terminal to run the venture — the studio renders what the lanes are doing and lets you drive the
gates from your phone. The terminal is still there underneath if you ever want it.
