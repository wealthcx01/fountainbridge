# FB-186 — the desk states its surfaces twice, and is still 700px over its design

**Status:** Done · **Phase:** 3 · **Found by:** FB-183, 2026-09-03

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
count once. The desk came down from 2,912px to 2,603px, against a 2,500px target it did not meet.

The remaining 103px was not more duplication. It was that **the content column beside the rail was
766px where the design's is 1,080px** — 29% narrower, so every sentence wrapped sooner and every
block was taller. That was one line, it moved every screen in the studio, and it shipped as FB-188.

## Closed out 2026-09-30 (FB-178)

**Closed 2026-09-30.** Every change this ticket asked for has shipped, and the reading its target is
stated against has now been taken on ARCA's own data — **1,689px**, against a 2,500px target.

The "cannot sign in to production" blocker recorded here was not real. Git is the source of truth for
work items, so a local build with a real `GITHUB_TOKEN` reads exactly the data production reads, and
`gh auth token` had held `repo` scope on `wealthcx01/arca` the whole time. The full reasoning is in
FB-178; `scripts/measure-on-real-data.mjs` takes the reading again.


**FB-188 landed, and the 103px went with it.** The desk now measures **2,165px at 1440×1000** — 335px
under this ticket's 2,500px target, and 438px below where this ticket left it.

Measured again over a venture the size ARCA actually is — 73 tickets and 1,773 run reports, against
the six this gate's fixture used to hold — it is **2,230px**. Still under target. The full reasoning
for why that second reading was needed, and why a six-ticket fixture could not produce it, is in
FB-178 and in `docs/design-conformance.md`.

| the desk, at 1440×1000 | height |
| --- | --- |
| when this ticket was written | 2,912px |
| when this ticket shipped in part | 2,603px |
| the gate's fixture, with FB-188 landed | 2,165px |
| a fixture at ARCA's size (73 tickets, 1,773 runs) | 2,230px |
| **ARCA's own data, as its founder (73 tickets, 9,889 runs)** | **1,689px** |

On a phone it is 2,175px. Below the design's own ~1,900px, and **1,223px below where this ticket
left it**.

The reading is over ARCA's real ticket titles and approval text, so the wrapping question the fixture
could not answer is answered: those are the venture's own words, at its own length. Signed in as the
founder rather than as an admin, because an admin sees wiring warnings a founder never does and they
cost 136px.

Neither viewport scrolls sideways, and nothing on the screen reported a failed read — so this is not
the height of a degraded page. Both screens were looked at as pictures.

## Acceptance criteria

- [x] The desk states each surface once.
- [x] The desk is under 2,500px on ARCA's production data at 1440×1000. **1,689px**, signed in as
      ARCA's founder over its own 73 tickets and 9,889 run reports. 2,175px on a phone.
- [x] Nothing reachable from either block today becomes unreachable.
