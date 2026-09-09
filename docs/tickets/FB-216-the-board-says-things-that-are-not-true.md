# FB-216 — the board says four things that are not true, and nothing notices

**Status:** Done · **Phase:** 3 · **Branch:** `fb-216-the-board-says-two-things-that-are-not-true`
· **Found by:** John asking what was left, 2026-09-09

## What happened

John asked what was outstanding. Answering it meant reading the ticket board, and the board was
wrong in four places. Two of them would have cost him time directly.

**FB-170 said "Blocked on John: create the Supabase project."** The project exists, the schema is
applied, `lib/db.ts` connects to it through the shared pooler, and two more migrations landed on top.
That happened on 2 September. The line was still there a week later, and it reads as a live blocker
naming the one person who cannot act on it — because there is nothing to act on.

**FB-044 said "In review."** It is the ActiveGraph safety keystone from Phase 2. Its work shipped as
FB-051 a month ago, under a different name. Every count of "what is left" has included it since.

**FB-047 and FB-069 said "In progress."** Neither has been touched in 21 days. Both are genuinely
part-shipped with real acceptance criteria still unticked — the status is not false so much as
misleading: "in progress" means somebody is working on it now, and nobody is.

## Why it matters more than four lines of markdown

The board is what a founder and an operator read to know where a venture stands. `ticket-drift`
exists because a ticket that disagrees with the code is a lie told at scale — its own error message
says *"The board shows a founder what these files say. If one of them is wrong, so is the board."*

That check compares a status against the git history. It cannot see a **stale** status, because
nothing changed — which is exactly the failure here. FB-044 sat "In review" for a month and every
gate stayed green.

## Scope

- Correct the four: FB-170 (not blocked; say what is actually left, which is the read model),
  FB-044 (superseded by FB-051), FB-047 and FB-069 (shipped in part, with what remains).
- **Add a staleness rule to `ticket-drift`.** A ticket marked `In progress` or `In review` whose file
  has not changed in 14 days is drift: either it shipped under another name, or nobody is progressing
  it. Both need saying.
- Only those two statuses. `Todo` and `filed` are a backlog and are *supposed* to sit still; flagging
  them would make the check noise, and a noisy check gets switched off.

## Out of scope

A rule that catches a false "Blocked on <person>" line in the body while the status says otherwise.
It is a real gap — it is what made FB-170 misleading — but it needs a shape that will not fire on
every ticket describing a blocker it already cleared. Worth its own ticket if it happens again.

## Acceptance criteria

- [x] The four tickets say what is true.
- [x] `ticket-drift` fails on a ticket marked `In progress` or `In review` and untouched for 14 days.
      Proven against the real case: restoring FB-044 to "In review" fails the check with
      *"has not changed in 39 days"*.
- [x] It does not fire on `Todo` or `filed`.
- [x] A test proves both halves — one stale ticket caught, one backlog ticket ignored. Six tests;
      disabling the threshold turns three of them red.
