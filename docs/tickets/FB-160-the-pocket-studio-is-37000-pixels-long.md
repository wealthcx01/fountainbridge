# FB-160 — The pocket studio is right, and then the page goes on for 37,000 pixels

**Status:** Todo · **Area:** Studio / mobile · **Depends on:** FB-138

## What was measured

Production, ARCA's founder, 390×844. FB-138 put the four pocket sections in the design's order and
they are correct — blocker at y=211, the office at 351, the queue at 520, the prompt at 1188, no
sideways scroll.

**The full-page screenshot is 37,678 pixels tall.**

Everything below the prompt bar — the brief, the surfaces, the three lanes with every ticket in
them, the run reports, the approval cards — is the desk, rendered underneath. About **97% of the
page** is below the pocket studio.

## Why this matters (for the founder)

The design calls screen 11 *"the studio that fits in the hand"* and gives it four things and a way
back: *"A founder keeps this open all day."* A screen you keep open all day is not one you scroll
past forty thousand pixels of backlog on.

It is also a battery and data question on the surface most likely to be on a phone network.

## Why FB-138 did not do it

Reordering is safe; hiding is not, and the obvious hiding rule removes the wrong things. The
external-action approval cards ("Needs your OK — before anything goes out") sit below the queue, and
they are exactly what a founder must be able to decide on a phone — the thing FB-138 exists to make
possible. A rule that hid "everything that is not one of the four" would have taken the gate off the
phone while claiming to improve it.

So the length was measured and left, deliberately, rather than fixed by guess.

## Scope

- Decide what the pocket studio *contains*, rather than what order it puts everything in. The
  starting proposal: the four, **plus anything a founder can act on** — the approval cards, the
  degraded strip (FB-137: a founder must still see what could not be read) — and a link to the rest.
- A way to the full desk from the pocket studio, and back. `?full=1` needs no client state.
- Whatever is hidden must be **hidden, not duplicated**. A phone-only second copy of these sections
  is how the rail's waiting shell and the ledger's fallback table each shipped a duplicate test id
  (FB-158, FB-136).

## Out of scope

- The PWA shell and push — FB-141.

## Acceptance criteria

- [ ] The pocket studio is under 6,000px tall on a venture with a real backlog, measured on
      production at 390×844.
- [ ] Nothing a founder can act on is hidden: approvals, refusals and the degraded strip all remain.
- [ ] The full desk is one press away, and the pocket studio one press back.
- [ ] No section appears twice in the document at any width.
- [ ] Measured on production at 390×844 and 430×932, with the page height recorded here.
