# FB-186 — the desk states its surfaces twice, and is still 700px over its design

**Status:** Shipped in part · **Phase:** 3 · **Found by:** FB-183, 2026-09-03

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

**Shipped in part.** The desk states each surface once now, and each card states its own ticket
count once. The desk came down from 2,912px to 2,603px, against a 2,500px target it does not meet.

The remaining 103px is not more duplication. It is that **the content column beside the rail is
766px where the design's is 1,080px** — 29% narrower, so every sentence wraps sooner and every block
is taller. Our own stylesheet says it meant to give the content ~1,080px; the 68rem measure includes
the rail, so it does not. That is one line and it moves every screen in the studio, which is why it
is FB-188 and not folded in here.

## Acceptance criteria

- [x] The desk states each surface once.
- [ ] The desk is under 2,500px on ARCA's production data at 1440×1000. **2,603px — the rest is FB-188.**
- [x] Nothing reachable from either block today becomes unreachable.
