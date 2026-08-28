# FB-118 — Filed ticket ids don't match the width of the backlog they join

**Status:** Done · **Area:** Composer / ticket-filer · **Depends on:** FB-117

## What happens

Every ticket ARCA has is three digits — `ARCA-001` through `ARCA-067`. Every ticket the composer
files is two — `ARCA-68`, and after FB-117 shipped, `ARCA-73` and `ARCA-74`. So the backlog now reads
in two formats, and which one a ticket has depends on nothing a founder can see: whether a person or
the composer created it.

`nextTicketId` builds the id as `${prefix}-${highest + 1}` (`deploy/librechat/ticket-mcp/ids.mjs`).
Nothing is wrong with that on its own — it is simply blind to the width every other ticket uses.

## Why it is worth fixing rather than living with

Small, and not nothing:

- The board sorts numerically (`lib/tickets.ts:121`, `localeCompare` with `numeric: true`), so sorting
  survives. Anything that sorts these as plain strings does not, and `ls docs/tickets/` is the first
  thing anyone does on a venture box.
- It is a visible seam between "work a person filed" and "work the composer filed", in the one
  artifact that is meant to make those indistinguishable.
- The five tickets of the 2026-08-23 dogfood run had to be renumbered by hand to `ARCA-068`…`ARCA-072`
  to match. Doing that by hand again on the next venture is the tell that it belongs in the allocator.

## Scope

- Allocate at the width the venture's existing ticket filenames already use, rather than a fixed one.
  ARCA is three digits; a venture whose first ticket the composer files has no width to match and
  should get a sensible default.
- Cover the cases in `ids.test.mjs`: a padded backlog, an unpadded one, a mixed one, an empty one, and
  the roll from `ARCA-099` to `ARCA-100`.

## Out of scope

- Renumbering the existing two-digit tickets. `withTicketId` deliberately leaves a ticket that already
  carries a real number alone, and renaming one a founder has been told the name of costs more than
  the tidiness is worth. New ids match; old ones stay.
- Any change to how ids are *allocated* — FB-117 settled that. This is only how they are rendered.

## Acceptance criteria

- [ ] A ticket filed into ARCA's backlog is named `ARCA-075`, not `ARCA-75`.
- [ ] A venture with no tickets yet still gets a usable id.
- [ ] A backlog of mixed widths picks one deterministically rather than by whichever file sorts first.
- [ ] `ARCA-099` + 1 is `ARCA-100`, not `ARCA-0100`.
