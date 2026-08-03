# FB-108 — What happened, summarised — not listed

**Status:** Todo · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"What happened seems
somewhat useful, but need at least an AI summary at the top which tells you the summary of the
tickets that have been worked in aggregate, the recent tickets worked, and what the goal is."* ·
**Repo:** fountainbridge · **Branch:** `fb-108-what-happened-summarised-not-listed` ·
One ticket = one branch = one PR.

## The gap

"What happened" is a well-ordered list with no reader's digest. A founder returning after three
days away wants the paragraph a chief of staff would open with — *what moved, where it's heading* —
and instead starts cold on item one of forty. FB-096 (filed) makes the individual rows truthful;
this ticket gives the page its opening paragraph.

## What ships

**A composed summary at the top**, per venture and per selected window, three sentences shaped as:

1. **Aggregate:** "In the last 14 days your team finished 9 pieces of work — most of it on the
   product (7), plus 2 additions to what your venture knows."
2. **Recent, by name:** "Latest: the interface audit (14 findings filed), set names on card
   pages." — the two or three most recent, linked.
3. **Direction:** "Most of the open queue is aimed at real market data and the new brand
   direction." — derived from the open backlog's areas plus deposited decisions (the brand
   positioning note is exactly the kind of goal-post this sentence reads from).

**Composed, not modelled, first.** Sentences 1–2 are deterministic aggregation — testable, cheap,
never wrong. Sentence 3 starts as honest aggregation ("most open work is in: pricing, brand") and
can graduate to a model-written line later via the venture's own composer engine — the engine and
key already exist per venture — behind a cache so the page never waits on a model. If the model
line is unavailable, the deterministic line stands; the page never blocks and never fabricates.

**The same summary is the seed for FB-104's brief** where they overlap ("what got done lately") —
one computation, two surfaces, per the one-source rule.

## Explicitly NOT here

- Feed row classification and noise (FB-096 owns it; this ticket assumes its categories).
- Push/email digests (a channel decision for later — this is the in-studio paragraph).

## Acceptance criteria

- [ ] The page opens with ≤3 sentences answering: how much, what recently, aimed where.
- [ ] Numbers agree with the rows below and with the board's brief (one computation).
- [ ] The summary renders instantly with or without the optional model-written line.
- [ ] Unit tests pin the composition on a fixture window of real ARCA history shapes.
