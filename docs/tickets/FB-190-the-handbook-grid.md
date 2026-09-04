# FB-190 — the Handbook's "phone unexplained" was a mis-framed row, and the real gap is the grid

**Status:** Done · **Phase:** 3 · **Found by:** FB-189's sweep, 2026-09-04

## The row this starts from

`docs/design-conformance.md` carried:

> | Handbook | 1,000px | 1,096px | 1,782px | matches on desktop; phone unexplained |

and, in prose:

> **Handbook is 1,782px on a phone against 1,096px on desktop.** A page of prose should get
> *shorter* in a narrower column only if the type scales; growing by 62% suggests something is not
> reflowing. Unexplained, and worth ten minutes.

Three things in that are wrong.

**It is not a page of prose.** It is nine chapter cards in a 3×3. Three across becomes one across on
a phone, so nine stacked cards are *expected* to be taller. Growing 62% is less than the 3× the
change in columns would suggest, not more.

**The desktop number is a floor, not the content.** The cards end at about 660px. The page measures
1,096px because the rail sets the height. So the comparison was a card grid against an empty space.

**And the phone has nothing to compare against.** The design bundle is a fixed-width prototype: at
393px it still draws the 250px rail and the three-column grid, crushed and overflowing. Its "phone"
reading of 1,050px is the desktop layout squeezed, not a phone design. The design's phone answer is
the pocket studio, and it has no handbook.

**There is no phone defect here.** 1,760px is what a nine-item list looks like on a phone.

## The gap that is real, and it is at both sizes

The design draws the chapter index as **one block with hairline rules between the cells** — no gaps,
no borders round each chapter, the whole thing reading as a single table. Ours is nine separate
bordered cards with a 1rem gap between them.

That is a design-conformance difference at every width, and on a phone it is also nine card borders
and eight gaps of vertical space that the design does not spend.

## Scope

- The chapter index is one ruled grid, matching the design.
- Keep the three-across, two-across, one-across steps; only the treatment changes.
- Every chapter stays reachable and keyed as it is now.
- Re-measure both sizes and correct the scorecard row and its paragraph, which are wrong.

## What shipped

| | before | after |
| --- | --- | --- |
| desktop | 1,096px | 1,096px |
| phone | 1,760px | **1,581px** |

Desktop does not move, and that is the point of the third paragraph above: on desktop the cards end
around 660px and the rest of the 1,096px is the rail. The number was never measuring the content.

The phone lost 179px — eight gaps and eighteen card borders that the design does not spend.

## Acceptance criteria

- [x] The chapter index is one block with rules between cells, not nine bordered cards.
- [x] Rendered beside the design at 1440×1000 and 393×851 and read.
- [x] No screen scrolls sideways at either size.
- [x] The scorecard says what the phone number actually is, and stops calling it unexplained.
