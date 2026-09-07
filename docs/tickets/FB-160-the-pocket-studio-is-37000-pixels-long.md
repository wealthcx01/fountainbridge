# FB-160 — The pocket studio is right, and then the page goes on for 37,000 pixels

## Re-measured 2026-09-02, after FB-178

The 37,678px in this ticket's title is stale — that was before the desk's ticket board was removed.
On an iPhone 13 profile against production today:

```
the phone desk, total                4,221px
  blocker banner                        85px   the design has this
  the office                           568px   the design has this
  waiting on you                       668px   the design has this
  the prompt bar                       112px   the design has this
  what the engine did                  305px   THE DESIGN DOES NOT PUT THIS ON A PHONE
  your surfaces                      1,031px   THE DESIGN DOES NOT PUT THIS ON A PHONE
```

The design's own description of this screen is exact: *"The same events, one column: the blocker
banner, the live office, the queue, the prompt."* Four things, about 600px.

So there are two separate problems and they want different fixes. The four sections the design does
have are together 1,433px — more than twice the design's whole screen — which is a density problem.
And two sections it does not have are adding another 1,336px, which is a question of what belongs on
a phone at all.


**Status:** Done · **Area:** Studio / mobile · **Depends on:** FB-138

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

## What shipped, 2026-09-03

**2,745px at 390×844**, down from 4,221px when this was written and 4,398px on the day it was done.
2,698px at 430×932. The whole desk is still there behind `?full=1`, at 4,360px.

The pocket studio carries what the design names — the blocker banner, the office, the queue, the
prompt — plus everything a founder can act on, plus one press to the rest:

| stood down on a phone | why |
| --- | --- |
| `Founder: you · updated just now` | not on the design's phone |
| `Your team — AI working on this venture's own machine` | not on the design's phone |
| the desk summary | the amber banner beneath it already says what a founder is blocking |
| what your team has been doing | a record, and What happened is the screen for records |
| your surfaces | not on the design's phone; 1,104px of it |

**What stayed, and why.** "Where things stand" names the ticket that is stuck and needs a human, and
that appears nowhere else on the pocket studio — a stuck ticket is not waiting for an approval, so it
is not in the queue. The rule is that nothing a founder can act on is hidden, and that is the
clearest thing on the screen they can act on. Since FB-183 the external sends are rows in the queue,
so the approval gate is on the phone by construction rather than by exception.

A lane's read failure reaches the top-level degraded strip as well as the surface card
(`page.tsx` builds the strip from the lanes), so standing the cards down hides no failure.

**Two things looking found that measuring had not.** The venture's NAME was rendering after the
prompt bar — everything the pocket order does not name falls to `order: 5`, and that included the
title, so a founder scrolled the whole screen before being told which venture they were looking at.
And the queue rows put the title and "waiting 34 days Decide →" side by side in a 345px column, so
every title wrapped to three lines; on a phone the row is two lines now, which is the design's shape.

**And one duplicate id.** Two surfaces with an empty queue rendered two elements answering to
`lane-empty`. Keyed on the repository now, like everything else on that screen (FB-058).

## Acceptance criteria

- [x] The pocket studio is under 6,000px tall on a venture with a real backlog, measured on
      production at 390×844. **2,745px.**
- [x] Nothing a founder can act on is hidden: approvals, refusals and the degraded strip all remain.
- [x] The full desk is one press away, and the pocket studio one press back. `?full=1`.
- [x] No section appears twice in the document at any width. **Pinned by a test, which found one.**
- [x] Measured at 390×844 (**2,745px**) and 430×932 (**2,698px**), recorded above.
