# FB-183 — one place to make a decision, and the desk is not it

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-02

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

**First slice (2026-09).** An external send has its own page, the desk carries rows and cannot sign,
and a founder can now refuse as well as approve. At the time the height criterion was not met — see
FB-186, and the closing slice below, where it now is. The measurement that shows why: the desk is 3,185px with the
cards already gone, because ARCA has one external send and the design's row shape adds a line of
meta to all ten waiting rows, so the two roughly cancel. The desk's real remaining height is its
surfaces, stated twice.

## Slice 2 (2026-09-29): the rule became a mechanism

The rule was written down in **three separate comments** and was still only a sentence. D13's finding
applies to architectural rules as much as to knowledge bases: *anything that must happen every time needs
a mechanism, not a sentence.*

`lib/__tests__/one-signing-surface.test.ts` walks every source file under `app/`, `components/`, `lib/`,
`scripts/` and `deploy/` and asserts six things:

1. The walk found a real tree — a guard on the guard, because a renamed directory would make every check
   below pass by finding no violations anywhere.
2. **Exactly one component** calls `approveExternalAction` / `refuseExternalAction`, and it is
   `ApprovalCard`.
3. **Exactly one page** passes `decide`, and it is the approval page. This catches a second signing
   surface even if the card is rendered somewhere new, because it is only a signing surface when `decide`
   is passed.
4. **The desk renders no `ApprovalCard` at all.**
5. No studio tool can grant — cross-checked here as well as in `mcp.test.ts`, because this is the file a
   person reads when asking "where can a grant happen?" and an answer omitting the tool surface would be
   wrong.
6. Nothing under `deploy/` calls the grant actions. The lane proposes.

### A vacuous test, caught by trying to break it

The first version of check 4 looped over the desk's `<ApprovalCard>` elements asserting none passed
`decide`. **There are none** — the desk renders rows now — so it looped over nothing and passed no matter
what. It was found because the mutation could not even be applied: the patch script reported "no
ApprovalCard element found".

**The real property turned out to be stronger than the one first written**, and an empty loop was hiding
it. The test now asserts the absence directly.

The same slip was in the source: a comment in `VentureBoard.tsx` said *"every `ApprovalCard` below renders
read-only, because `decide` defaults to false"* — true when written, stale once the last one went, and it
was what made the weaker test look sufficient. Corrected.

### Both mutations now caught

- Rendering `<ApprovalCard ... decide />` on the desk → 2 tests fail.
- A second component importing `approveExternalAction` → 1 test fails.

### What this does not unblock

**`propose_approval`, the eighth MCP tool, is still blocked** — and for a different reason than this
ticket addresses. This proves there is one place a grant is **signed**. That tool needs one place a
proposal is **written**, and today proposals are written by the lane (`deploy/lane/proposal-lib.mjs`) with
no studio-side writer at all. Giving the studio one is its own ticket, and until it exists a tool would be
a second writer for the record that gates every external action.

## Closing slice (2026-10-01): checking the four boxes nobody had checked

Four criteria were unticked. Three turned out to be true already and one was not.

**Refusing had never been tested.** The refuse button shipped on the send's page with no test behind
it, so "a send can be refused" was a claim. `app/actions/__tests__/approvals.test.ts` now holds seven
refusal tests. The important one writes a refusal and then reads it back with the same code that
decides whether a send is closed, so a refusal the studio would later ignore fails the test. The
others: a reason is required; a proposal that changed after the founder read it is not refused; a
refusal is never written over a send that already went out, nor over one a named person approved; a
send whose "approval" nobody can vouch for CAN still be refused; and only the right approver can refuse.

**A refused send disappeared from everywhere.** This was the real fault. "What happened" dates a
decided send by its grant or its execution, and drops any row with no date. A refused send has
neither — the refusal is its own signed file, with its own time. So every refusal was dropped from
"What happened", and since a refused send is no longer waiting, it was linked from nowhere at all. It
also would have said "Someone sent back", because the name was read from the grant. Now the row uses
the refusal's own time and the name of the person who refused. `lib/__tests__/every-send-is-reachable.test.ts`
checks that every send in the UI gate's fixtures, and a refused one, is linked from either the
"Needs you" list or "What happened".

**The desk's height.** Read on ARCA's real data as its founder, on a local build pointed at the same
repositories production reads: **1,689px** at 1440×1000 (2,175px at 393×851). Under the 2,500px line.

**Seen.** The send's page, at both sizes, with the refusal box open: 1,000px and 1,014px. Approve,
the reason box, "Send it back" and "Never mind" are all on it, and nothing else on the studio can sign.

**One limit worth knowing.** A decided send from before the studio recorded times (a "v0" record,
with no time on its grant or its execution) still has no row on "What happened", by that page's own
rule that it does not invent dates. None of ARCA's records is like that today.

## Acceptance criteria

- [x] An external send can be approved and refused from its own page.
      *(The page carries both; `e2e/approvals.spec.ts` "the row is a pointer…" opens it from the desk
      and finds both controls; the approve and refuse actions each have unit tests, refuse's added in
      the closing slice.)*
- [x] The desk carries rows, not cards, and no approve control.
      *(`one-signing-surface.test.ts` check 4; `e2e/approvals.spec.ts` asserts no `-approve` control
      on the desk.)*
- [x] The desk is under 2,500px on ARCA's production data at 1440×1000.
      *(1,689px on 2026-10-01, read on ARCA's real data as its founder.)*
- [x] A test proves the ActiveGraph grant is signed on exactly one surface.
      *(FB-183 slice 2, 2026-09-29: `lib/__tests__/one-signing-surface.test.ts`. A source-level test,
      because the property is structural — it is not "the button works", it is **"there is only one
      button"**, and no runtime test can prove a second surface was not added elsewhere. Only reading
      the whole tree can.)*
- [x] No approval is left unreachable at any point in the change.
      *(`lib/__tests__/every-send-is-reachable.test.ts`. It found that a refused send was reachable
      from nowhere, which is fixed. The one exception left is a decided send with no recorded time,
      described above.)*
