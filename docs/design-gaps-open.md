# Open design gaps — for Claude Design

**Updated 2026-09-29.** Each gap is a question only a design decision answers. None is a bug and none is
blocking code: where a gap exists, the code has taken the honest option and is waiting.

**How to use this.** Take a section to Claude Design as-is. Each one states what a founder sees today,
why that is not obviously right, and what a ruling would settle. When a gap is closed, the ruling goes in
`docs/design-conformance.md` with a reading, and the section here is removed.

The design artifact is the one named in CLAUDE.md #11:
`https://claude.ai/code/artifact/7187a06f-f746-4e70-bfc6-446a3d7330ac`.

---

## 1. What does the desk look like when the real work happens somewhere else?

**New, from D10 (2026-09-29). The biggest of the three.**

**What changed.** John ruled that Claude Code is the workbench and the studio is the ledger. So the desk
becomes **read-mostly**: what needs you, what happened, per-surface outcomes, the office. Its write
actions shrink to approve / decline / reassign / open-in-Claude, and the prompt bar stops being a
composer and becomes a **launcher** that seeds a Claude Code session with a ticket's context.

**Why this needs a design answer and not just a code change.** The desk was designed as the place work
gets started. If the making now happens in Claude Code, the desk is a different kind of screen — closer
to a set of books than a workbench — and nothing in the artifact shows that screen. Three specific
questions:

- **Does the prompt bar stay, and what does it say?** It currently invites a founder to describe work. As
  a launcher it would be doing something quite different, and a text box that looks like a chat but opens
  another application is a small lie about itself.
- **What does "open in Claude Code" look like on a phone?** A founder on a phone can now start a session
  on their machine. That is genuinely new and there is no design for it.
- **How does the desk serve a founder who never installs Claude Code?** This is the important one. D10
  keeps the composer as the plain door precisely so the desk stays whole without it — but "whole without
  it" has to be a designed state, not a fallback nobody drew. Sell and Scale founders may never open a
  terminal.

**What the code does meanwhile.** Nothing. No desk change has shipped and none will until this is ruled.

---

## 2. What does an empty office look like?

**New, from FB-218 (2026-09-29).**

**What changed.** The office was drawing **120 figures over a machine where nothing had run for two
hours** — the board lying. FB-218 bounded it: an agent whose transcript has not been written for 30
minutes is no longer drawn. Measured on the real room, 120 became 0.

**So empty is now a normal state**, not a fault. The lane wakes on a timer, so between wakes there is
genuinely nobody working, and the honest picture of that is an empty room.

**Why it needs a ruling.** FB-218's own words: *"An empty office over a working machine is a worse lie
than a full one."* The bound makes sure empty only happens when the machine really is idle — but nobody
has decided what a founder should *see* then. An empty room with furniture and no people could read as
"broken" rather than "resting", and a founder who reads it as broken has been misled by an accurate
screen.

Options worth considering rather than a recommendation, because this is a taste call:

- The room as it is, simply with nobody in it.
- A resting state — lights lower, a line of copy saying when the team next wakes.
- The last thing that happened, held on screen until the next wake.

**What the code does meanwhile.** Draws the empty room. It is truthful and possibly unfriendly.

---

## 4. Two design tokens that do not exist, used on four screens

**FB-150, already filed, needs a design answer before it can be fixed.**

Four screens reference two tokens that are not in the token set. The code cannot invent them:
CLAUDE.md's stack section says pull the existing grassmarket / Bruntsfield tokens and **do not invent a
theme**. So this waits on either the tokens being added to the set, or the screens being pointed at
tokens that exist.

Naming them here so the ticket is not mistaken for a code problem.

---

## 5. The ledger fits a phone and cannot be read on one

**FB-215, already filed.**

It passes the phone gate — nothing scrolls sideways at 393px — and is still not readable. That is
precisely the failure non-negotiable 11 exists for: correct and unusable at the same time.

FB-226 now gives this a measuring instrument (`scripts/visual-parity-diff.mjs`), but the instrument
cannot decide what a seven-column table should *become* on a phone. Cards, a chosen subset of columns, a
different screen entirely — that is a design decision.

---

## Closed

### 3. Should a figure mean an agent at all? — RULED 2026-09-30

**A figure means a piece of work.** John: *"one machine and one character per ticket, helpers
invisible."*

So one ticket gets one temporary machine and one character, however many subagents the worker spawns
inside itself. Those are never drawn. The room stays a picture of what the company is doing rather than
of how the runtime parallelised, which was the objection FB-218 raised when it found one wake spawning
eight.

Built in FB-239. A reading goes in `docs/design-conformance.md` when the office first draws a worker
under this rule.
