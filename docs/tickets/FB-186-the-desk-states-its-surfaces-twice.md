# FB-186 — the desk states its surfaces twice, and is still 700px over its design

**Status:** Open · **Phase:** 3 · **Found by:** FB-183, 2026-09-03

## The measurement

| | design | live desktop | live phone |
| --- | --- | --- | --- |
| The desk | ~1,900px | **3,185px** | **5,190px** |

FB-183 was expected to close this gap and could not. It removed the external-approval cards, which
is the right change and which the design asks for — but on ARCA that is one card, and the design's
own row shape adds a line of meta to all ten waiting rows. The two roughly cancel.

So the desk's remaining 1,285px is somewhere else, and this ticket is that somewhere.

## What is actually on the screen

Reading the desk at 1440×1000 as ARCA's founder, the venture's surfaces are stated **twice**:

- `dept-surfaces` — three cards, **505px**: *"Build — Product · ACTIVE · Work here is approved by
  review. 4 waiting for your OK · 14 in progress. 73 tickets…"*
- and immediately beneath them, an ungrouped list repeating the same three: *"Build — Product `arca`
  73 tickets · 20 waiting to be picked up · 14 being worked · 2 needing your OK — open the queue"*

Same three surfaces, same counts, different words, one under the other. The design has one block —
*"The company, by surface"* — with three compact cards and a link out of each.

## Why it matters

The desk is the screen a founder leaves open. FB-178 settled the principle: *a page you read, not a
page you scroll.* Saying the same three facts twice is the clearest remaining breach of it, and it
is the kind of thing only looking finds — every count in both blocks is correct.

## Scope

- One block for the surfaces, matching the design's *"The company, by surface"*.
- Keep whichever of the two carries the links a founder actually presses; the other's facts fold in.
- Re-measure both viewports and put the numbers in the PR (CLAUDE.md rule 11).

## Acceptance criteria

- [ ] The desk states each surface once.
- [ ] The desk is under 2,500px on ARCA's production data at 1440×1000.
- [ ] Nothing reachable from either block today becomes unreachable.
