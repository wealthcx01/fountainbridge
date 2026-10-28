# FB-281 — Sending work back also labels it "accepted"

**Status:** Todo · **Kind:** small · **Budget:** $10 · **Rough date:** 3 November 2026 · **Pilot step:** 3a, after FB-274 · **Raised by:** John, 28 October 2026 (found while building FB-272; budget 28 October) · One ticket = one branch = one PR.

## Why

On a work page (`/venture/<id>/work/<repo>/<number>`), a founder who presses "Send it back with a
note", and whose note goes through, sees the tag **"accepted"** next to the decision. They said the
opposite. A founder reading that would think the work went into their product.

## What happens today

Since FB-273, one component draws Accept and Send back on every screen: `components/Decision.tsx`.
It already records which button was pressed (`result.decided` is `'accept'` or `'send-back'`), but
the tag ignores it. `stateLabel()` answers "signed off" for a founder's Accept and "accepted" for
everything else, Send back included. A comment above it names this ticket.

## What to do

Remember which decision was made, and say it:

- **Accept, by John:** "accepted" (as today).
- **Accept, by a founder:** "signed off" (FB-272).
- **Send back:** "sent back", with the note's own confirmation line, as today.

Only the work page is wrong. The Tickets screen already says "Sent back with your note"
(`decisionOutcome()`, in the same file). Remove the FB-281 comment above `stateLabel()` once it is
fixed.

## Done when

- [ ] After a successful Send back, the tag says "sent back" and never "accepted" or "signed off".
- [ ] A test fails on today's code and passes after.
- [ ] The work page is looked at after each of the three decisions, at 1440×1000 and 393×851.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Any other change to the work page.
