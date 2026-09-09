# FB-210 — squares, not glyphs, everywhere a founder reads

**Status:** Done · **Phase:** 3 · **Raised by:** Claude Design, 2026-09-08 (R-02) ·
**Branch:** `fb-210-squares-not-glyphs` · One ticket = one branch = one PR.

Third in the reviewer's order: after FB-207 and the Tickets pass, and before Memory.

## What was found

> `⚠` survives in `TicketsView`, `ActivityFeed`, `KnowledgeView`, `TicketTrail` and the desk's
> warnings badge; `ActivityFeed` uses a `●` dot. **Item 4 removed the glyph from the banner and item
> 13 made every state mark a square; the rest of the studio did not follow.**

That is a fair reading of what FB-203 actually did. The desk was taken through item by item and the
other screens were not, so the studio now marks state two ways depending on which screen you are on.

## Why it matters

An emoji is a different typeface at a size nobody chose. It renders differently on every platform, it
does not take the tone colour, and beside a serif sentence it reads as something pasted in. The square
was chosen because it is drawn by the same stylesheet as everything around it.

The accessibility half is unchanged and must stay: the mark is `aria-hidden` and the word is beside
it, because a state told only in colour is a state some readers never get.

## Scope

- One 8×8 square in the tone colour, `aria-hidden`, with the word beside it.
- No `⚠` and no `●` anywhere a founder reads.
- The named sites: `components/TicketsView.tsx`, `components/ActivityFeed.tsx`,
  `components/KnowledgeView.tsx`, `components/TicketTrail.tsx`, and the desk's `warnings-badge`.
- Sweep for the rest: `grep "⚠" and "●" under components/ and app/`.
- **Add it to `design-lint`.** This recurred because nothing checked it. A rule that catches a glyph
  in founder-facing markup is what stops the next screen inheriting the old habit.

## Out of scope

Glyphs in operator-only surfaces and in code comments. This is about what a founder reads.

## Acceptance criteria

- [x] `grep -r "⚠\|●" components/ app/` finds nothing in rendered founder-facing text. — 26
      occurrences across 16 files, all gone; the only ones left are comments explaining the rule.
- [x] `design-lint` fails on a newly added one. — the `state-glyph` rule, checked by planting one and
      watching it fail.
- [x] Every square is `aria-hidden` and every state still has its word.
- [x] The screens are read at both sizes and the readings recorded.

## Done, 2026-09-09

One component, `components/Mark.tsx`, and one rule in `design-lint` so the next screen cannot inherit
the old habit — which is the reason the glyphs came back at all: **nothing checked.**

**Looking caught a regression I had just written.** Replacing the feed's `●` with a square and
nothing else dropped `toneColor(item.tone)`, so every square on What happened came out **black** — a
record where a stopped run and a finished one looked identical. The tone travels with the mark now,
and a test asserts the feed draws more than one colour.

**Two things kept.** `✓` and `✗` on the approval card's check list are not state marks on a sentence;
they are a list of checks, and a screen reader reads them as words in a way `●` is not. They became
squares anyway where they marked a *state*, and the rule deliberately does not cover them.

And every `sr-only` label stayed exactly where it was. The mark is `aria-hidden` and carries no
meaning of its own — which is precisely why the sentence beside it has to keep saying what it always
said.
