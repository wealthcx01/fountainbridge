# FB-276 — Presses are checked on the server

**Status:** Todo · **Kind:** medium · **Budget:** $25 · **Rough date:** 5 November 2026 · **Pilot step:** 5 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

## Why

A press in the studio must go through the same path as a tap on Telegram, so the two never
disagree, and the studio must never act on factory work itself.

## What to do

- The studio checks who pressed, records it, and hands it to the planning box. It never calls
  Archon or GitHub.
- The box's listener collects it (cowgate CG-0066) and runs it through the same code as a Telegram
  tap. The first press wins; a card answered elsewhere loses its buttons and shows what happened.
- **A founder may press Stop, Send back and Accept** on their own venture's cards. Accept is their
  sign-off: the card says "Signed off by <founder>, waiting for John". **Only John** has Approve,
  Reject, Try again and Split it. Any other press from a founder is refused and recorded as refused.

## Done when

- [ ] Journey 5, and journey 6's press-door check, pass against a test copy.
- [ ] A founder calling Approve directly is refused, and nothing is recorded.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.
