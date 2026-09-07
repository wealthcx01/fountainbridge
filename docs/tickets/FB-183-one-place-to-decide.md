# FB-183 — one place to make a decision, and the desk is not it

**Status:** Shipped in part · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-02

## What was asked for

> "The 739px cards duplicate the ticket detail. Waiting items are the three compact rows (ref ·
> title · surface/meta · 'waiting X →'); the row opens the ticket, and the decision panel there is
> the only place a decision is made. **One decision surface, everywhere else is a pointer to it.**"

That rule is right, and it is the single largest thing still standing between the desk and its
design: `approvals-queue` is 739px of cards on a page that should be about 1,900px in total and is
currently 3,830px.

## Why it was not done with the rest of the feedback

**Because the desk is the only place an external send can be approved, and the rows would have
nowhere to point.**

`ApprovalCard` carries the approve control (`approval-<id>-approve`), and it renders in exactly one
place — the desk. An external action awaiting the ActiveGraph gate is not a ticket: it is a send, and
it has no ticket page. Turning the cards into rows before building somewhere for the rows to open
would delete the only way a founder can approve anything going out of their company.

That is CLAUDE.md non-negotiable 4 — *nothing external ever executes without a recorded human
approval* — and removing the approval is a worse failure than the layout it fixes.

It is also the mistake FB-178 made and had to correct mid-flight: the desk's ticket board looked like
a duplicate of the Tickets screen and was not, and three founder-facing behaviours were nearly
deleted with it. The rule that came out of that is now CLAUDE.md #11, and this ticket is it being
followed rather than learned again.

## Scope

1. **Give an external approval a page.** `/venture/<id>/approvals/<repo>/<id>`, or fold it into the
   Tickets screen's detail pane the way a pull request already is (FB-129 put orphan work there, and
   an external send is the same shape of thing: work waiting on the founder with no ticket file).
   Whichever is chosen, the ActiveGraph grant is signed there and nowhere else.
2. **Then** turn the desk's cards into the design's three rows: `ref · title · surface/meta ·
   "waiting X →"`. The row opens the page from (1).
3. Remove the approve control from the desk entirely once (1) exists. Two places to approve is two
   places to get the signing wrong.

**Shipped in part.** An external send has its own page, the desk carries rows and cannot sign, and a
founder can now refuse as well as approve. The height criterion is **not met and cannot be met by
this ticket's scope** — see FB-186. The measurement that shows why: the desk is 3,185px with the
cards already gone, because ARCA has one external send and the design's row shape adds a line of
meta to all ten waiting rows, so the two roughly cancel. The desk's real remaining height is its
surfaces, stated twice.

## Acceptance criteria

- [ ] An external send can be approved and refused from its own page.
- [ ] The desk carries rows, not cards, and no approve control.
- [ ] The desk is under 2,500px on ARCA's production data at 1440×1000. **Not met — FB-186.**
- [ ] A test proves the ActiveGraph grant is signed on exactly one surface.
- [ ] No approval is left unreachable at any point in the change.
