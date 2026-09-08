# FB-212 — the routines on Memory are still cards

**Status:** filed · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-09) ·
**Branch:** `fb-212-routines-are-rows` · One ticket = one branch = one PR.

Last in the reviewer's order.

## What was found

> Each routine is a bordered `.card` in a list. **Rule 2.**

Rule 2 is *"waiting items are rows"*, and the reviewer's verdict on it was **Held** — with two leaks
named: the desk's two ApprovalCard sections (FB-207) and this one.

## Why it matters

The document table directly above it on the same screen is already rows on hairlines. So Memory shows
two lists of things, in two shapes, for no reason a founder could name — which is how a screen stops
having a grammar.

## Scope

Rows on hairlines, in the same grid as the document table above them: square · title · cadence ·
state, with the reason beneath in mute.

`components/KnowledgeView.tsx` (the Routines block). The square is `aria-hidden` with the state's word
beside it, like every other mark since FB-203's item 13 — and `lib/routines.ts` already owns the
vocabulary (`STATE_LABEL`, `STATE_TONE`, `whyNotRunning`), so nothing here decides what a state is
called.

## Out of scope

The routines screen itself (`/venture/[id]/routines`), which is where they are changed. This is the
read-only summary on Memory.

## Acceptance criteria

- [ ] No `.card` in the Routines block.
- [ ] Its rows sit on the same grid as the documents table above.
- [ ] Every state still carries its word, and `whyNotRunning` still explains a routine that is not.
- [ ] Memory read at both sizes, and its height recorded in `docs/design-conformance.md`.
