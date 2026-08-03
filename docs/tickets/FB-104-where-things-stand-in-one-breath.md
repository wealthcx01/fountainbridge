# FB-104 — Where things stand, in one breath

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"the summary in 'Where
Things Stand' has to be much clearer and better on an aggregate level across tickets."* ·
**Repo:** fountainbridge · **Branch:** `fb-104-where-things-stand-in-one-breath` ·
One ticket = one branch = one PR.

## What the founder meets today

The brief is honest and unreadable. On John's walk it opened with a partial-picture disclaimer,
then FIVE separate "Stopped:" bullets — three of them about the *same* ticket, quoting the lane's
own validation reports verbatim ("the gate check changed the working tree instead of just
reporting, so its verdicts don't describe the committed code"). Machine self-talk, pasted into the
one paragraph whose whole job is orientation. The information is right; the altitude is wrong.

## The rule

The brief is an **executive summary, not a log**. It answers four questions, in four sentences or
fewer, aggregated across everything:

1. **What needs you, and how many?** — "6 pieces of work are waiting for your OK — the oldest for
   3 days." One line, one number, one link into the queue.
2. **What is your team doing right now?** — "Your team is working on the interface audit; it last
   checked in 2 minutes ago." Current ticket by name, linked.
3. **What got done lately?** — "3 tickets finished this week." Linked to What happened.
4. **What is stuck?** — ONE line, deduplicated by ticket: "2 tickets are stuck and need a human:
   the sign-in tagline and the price-history work." The lane's three attempts at one ticket are
   one fact, not three bullets; the machine's reasoning lives one click away on the ticket, not in
   the brief.

Anything the brief cannot compute it says in one honest line ("part of the picture could not be
read — numbers may be low"), once, at the end — not as a competing bullet per failure.

## What ships

- `lib/brief.ts` recomposed around the four questions: aggregation and dedup (by ticket, not by
  report), counts computed from the same sources the pages use (FB-099's one-source rule), every
  sentence linking to the surface that expands it.
- Stopped-report prose is summarised to *"stuck — needs a human"* + ticket name; the verbatim
  machine reasoning moves to the ticket/work view where a decision is actually made.
- Unit tests feed the exact walk state (five stopped reports across two tickets, one running, 15
  open PRs, partial read) and assert the four-sentence output.

## Explicitly NOT here

- Queue sizing (the standing design question) — the brief reports the number; what the queue shows
  is its own decision.
- Copy policing machinery (FB-103) — though this brief is written to pass it.

## Acceptance criteria

- [ ] The walk's real state renders as ≤4 sentences plus at most one honesty line.
- [ ] Repeated attempts at one ticket appear as one fact.
- [ ] Every sentence links to the page that expands on it.
- [ ] No verbatim lane/validation prose appears in the brief.
