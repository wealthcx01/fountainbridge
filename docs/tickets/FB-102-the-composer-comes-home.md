# FB-102 — The composer comes home

**Status:** Done · **Phase:** 3 · **Amends:** FB-086 (which moved it out) · **Asked for by:** John,
2026-08-04 — *"I then click 'Tell the studio what you want' and I can't login into LibreChat with
the demo account."* · **Repo:** fountainbridge ·
**Branch:** `fb-102-the-composer-comes-home` · One ticket = one branch = one PR.

## The story so far, honestly

FB-065 put the composer inside the studio, because sending a founder to a different product at a
different address to do the single most important thing they do is a bad seam. FB-086 moved it back
out to the box's chat — at John's request — because the in-studio one had never worked in
production (the key was never set; FB-087). That was the right call against a broken screen.

The screen is not broken any more. FB-095 fixed the engine (the walkthrough's brand ticket was
filed through the in-studio composer, end to end, against the live box), the key is set and
probed by readiness, and engine faults now surface in plain language. Meanwhile the external chat
door has grown its own cost: a second application with a second login — the exact failure John hit
today. Two sign-ins for one journey is one too many, and the second one guards the most important
button in the product.

FB-086's own text anticipated this: *"if the in-studio version proves itself later, the board is
one line away from pointing back at it."* It has proved itself. This ticket is that line.

## What ships

- The board's **"Tell the studio what you want"** goes to `/venture/<id>/composer` — same studio,
  same session, no second login.
- The box's chat stays exactly as it is (it works, John uses it, and it now takes email login
  too) — reachable via a quieter secondary link for whoever wants the full LibreChat surface,
  labelled for what it is, not dressed as the primary door.
- `e2e/composer.spec.ts` re-inverts the FB-086 assertion — and, per that file's own discipline,
  records WHY in place, so the history reads FB-065 → FB-086 → here as three dated decisions
  rather than churn.

## Explicitly NOT here

- Removing the box chat or its email login (just shipped; it stays).
- Composer feature work (documents surface is FB-106; ticket editing is FB-105).

## Acceptance criteria

- [x] A founder clicks the board's composer button and is composing within the studio, in one
      click, with no second sign-in.
- [x] The box chat remains reachable and labelled as the secondary surface.
- [x] The e2e suite drives the button to the in-studio composer and records the reversal's reason.
