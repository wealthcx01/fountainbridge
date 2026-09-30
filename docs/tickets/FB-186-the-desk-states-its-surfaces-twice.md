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
count once. The desk came down from 2,912px to 2,603px, against a 2,500px target it did not meet.

The remaining 103px was not more duplication. It was that **the content column beside the rail was
766px where the design's is 1,080px** — 29% narrower, so every sentence wrapped sooner and every
block was taller. That was one line, it moved every screen in the studio, and it shipped as FB-188.

## Closed out 2026-09-30 (FB-178)

**Shipped in part:** every change this ticket asked for has shipped and the desk is comfortably under
its target — but the one reading the target is stated against, on the production server, cannot be
taken until the studio can sign in to production.


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
| now, with FB-188 landed | **2,165px** |
| now, over 73 tickets and 1,773 run reports | **2,230px** |

**What is still not measured: the production server.** This ticket's target says "on ARCA's
production data", and that reading needs a signed-in founder session the lane does not have —
checked on 2026-09-30, and every request without one lands on `/login`. So the criterion below stays
unticked, with the number recorded beside it, rather than ticked over a fixture reading.

What that leaves genuinely open is narrow: production's ticket titles and approval text are real
sentences of unknown length, and a longer sentence wraps to more lines. The **number** of things on
the desk is proven bounded (`lib/__tests__/the-desk-is-bounded.test.ts`); the **height of each row
over real copy** is not. One production reading closes this ticket and FB-178's first criterion at
the same time.

## Acceptance criteria

- [x] The desk states each surface once.
- [ ] The desk is under 2,500px on ARCA's **production** data at 1440×1000. **Not measured — needs a
      signed-in session. It is 2,165px on the gate's fixture and 2,230px over a fixture at ARCA's
      real size, both under target.**
- [x] Nothing reachable from either block today becomes unreachable.
