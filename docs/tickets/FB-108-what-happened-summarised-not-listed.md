# FB-108 — What happened, summarised — not listed

**Status:** Done — sentence 3 written but not yet wired, see below · **Phase:** 3 · **Asked for by:** John, 2026-08-04 — *"What happened seems
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

- [x] The page opens with ≤3 sentences. **Two of the three are live** — how much, and what recently.
      The third is written and tested but not yet wired; see below.
- [x] Numbers agree with the rows below. The summary is built from `events` — the *same* array the
      feed renders, after the same deduplication and the same visibility filter — so the counts are
      arithmetic on the rows and there is no second pass that could drift. An admin and a founder
      see different rows and correspondingly different numbers, which is correct.
- [x] The summary renders instantly. It is pure aggregation: no model, no network, nothing to wait
      on, and nothing to cache.
- [x] Unit tests pin the composition on real ARCA history shapes — the lane's own titles and the
      paths each change touched, taken from what landed on 2026-08-19, not invented from the type.

## What is not wired, and why it is not pretended otherwise

`directionSentence()` — *"Most of the work still open is aimed at pricing and brand"* — **exists and
is tested, but nothing passes it any areas yet**, so the page renders two sentences, not three.

The reason is that it needs a fact the activity page does not currently load: what the *still-open*
backlog is about. The page loads health and activity; the open queue with its areas is a separate
read, and adding one to this page without care is how FB-083 (eighty-seven requests for one page)
happened in the first place.

The function is deliberately built to write nothing when it is told nothing, rather than to guess a
direction from the events it does have. A sentence about where the venture is heading, inferred from
what merely happened recently, would be exactly the confident-and-wrong copy FB-096 and FB-070 exist
to prevent. Two true sentences beat three with one bluffing.

Wiring it needs the open-backlog areas on this page within the request budget FB-083 set. That is a
small, separate piece of work.

## Deliberately still deferred

The model-written line. The deterministic version had to stand on its own first — a page that waits
on a model to say what happened is a page that sometimes says nothing — and now that it does, the
model line is an enhancement rather than a dependency.
