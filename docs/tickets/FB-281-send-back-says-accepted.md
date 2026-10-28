# FB-281 — Sending work back also labels it "accepted"

**Status:** Todo · **Kind:** small · **Phase:** 3 · **Raised by:** John, 28 October 2026 (found while building FB-272) · One ticket = one branch = one PR.

## Why

On a work page (`/venture/<id>/work/<repo>/<number>`), a founder who presses "Send it back with a
note", and whose note goes through, sees the tag **"accepted"** next to the decision. They said the
opposite. A founder reading that would think the work went into their product.

## What happens today

`components/WorkDetail.tsx` keeps one result for both decisions. `SendBack` reports into the same
`setResult` as Accept (`onDone={setResult}`), and the page then counts any successful result as
done (`const done = result?.ok || work.merged`). Done always draws the same tag: "accepted", or
"signed off" for a founder's Accept (FB-272). Nothing records which button was pressed.

## What to do

Remember which decision was made, and say it:

- **Accept, by John:** "accepted" (as today).
- **Accept, by a founder:** "signed off" (FB-272).
- **Send back:** "sent back", with the note's own confirmation line, as today.

Check `components/TicketsView.tsx` and `components/TicketDrawer.tsx` for the same mistake; FB-273
(one Decision component) will replace all three, so if FB-273 is already under way, fix it there
instead and close this ticket.

## Done when

- [ ] After a successful Send back, the tag says "sent back" and never "accepted" or "signed off".
- [ ] A test fails on today's code and passes after.
- [ ] The work page is looked at after each of the three decisions, at 1440×1000 and 393×851.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Any other change to the work page.
