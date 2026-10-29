# FB-276 — Presses are checked on the server

**Status:** Done · **Kind:** medium · **Budget:** $25 · **Rough date:** 5 November 2026 · **Pilot step:** 5 · **Raised by:** John, 28 October 2026 (the factory pilot, `docs/prd/factory-pilot-release.md`) · One ticket = one branch = one PR.

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

- [x] Journey 5, and journey 6's press-door check, pass against a test copy.
- [x] A founder calling Approve directly is refused, and nothing is recorded.
- [x] Every command in `CLAUDE.md` `## Checks` passes.

## What shipped

- **The press store**, `db/009_factory_presses.sql`: one row per press, kept by venture under the
  same forced row-level security as the cards. The studio may add presses and read them, and change
  only the box's part (when it collected one, and its answer). It may delete none. The database
  itself refuses a founder's Approve, Reject, Try again or Split it (`presses_john_only`), and a
  second press that settles the same version of a card (`presses_one_standing`).
- **The studio's side**, `lib/press.ts`, and the press door, `pressFactoryCard` in
  `app/actions/press.ts`. Accept and Send back on a factory card (`acceptWork`, `sendBackWork`) go
  the same way. Nothing here calls GitHub or Archon for a factory card. Work that is not a card goes
  to GitHub exactly as before.
- **The box's side**, three new kinds on the door: `collect`, `press-result` and
  `answered-elsewhere`, written down in `docs/factory-cards.md`.
- **The card's state** on the Review screen comes from the press store and the box's answers:
  signed off, sent back, approved and waiting for the factory, part of the product, rejected,
  stopped, out of date, and taps made on Telegram. A card the box has answered shows what it said,
  and no buttons.
- **John's other buttons** (Reject, Try again, Split it, Stop) are built on the server and in the
  door, but have no place on the screen yet: the Review screen's design has none for them. Pressed on
  Telegram, they show on the card.

## Two things this ticket settled

- **A refused press is not recorded.** "What to do" says a founder's other press is "recorded as
  refused"; journey 5 says it is refused "and nothing is recorded". Both hold like this: a refused
  press is never written to the press store, so the box can never collect it. It is written as one
  line to the studio's log instead (`[press] refused: <who> pressed <what> on <venture> <repo>#<n>`),
  so John can see who tried what.
- **Sign-offs come back on their own.** Journey 5 says the stand-in collects nothing after a
  founder's Accept; the PRD says the sign-off shows on Telegram. Both hold because `collect` hands
  out a founder's sign-off in a separate list, `signOffs`, for Telegram's card text only, and never
  in `presses`, which is what reaches Archon.
