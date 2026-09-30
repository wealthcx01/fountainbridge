---
name: design-against-the-artifact
description: Build a screen against the approved design and prove the match with real captures, rather than stopping at the first approximation. Use when implementing or changing any studio screen. The reference is the Claude Design artifact, not a generated mockup. Adapted from dzhng/skills design-with-images.
---

# Design against the artifact

Adapted from `visual/design-with-images` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> **The deliverable is the working design, visibly matched to the approved reference.** Do not stop at the
> mockups or the first code approximation.

## What is different here

Theirs generates images to explore a direction, then implements against the chosen one. **We do not need
the exploring half:** the design already exists and John owns it. The reference is the Claude Design
artifact named in CLAUDE.md #11, and it is a **working prototype, not a picture** — open it with Playwright,
press "Continue with Google", click the rail's labels to reach each screen.

So what carries over is the second half, and it is the half that matters: **implement, capture, compare,
iterate — and do not stop at the first approximation.**

## The loop

1. **Pin what may change and what must not.** Content, framing, palette, interactions, the surrounding
   rail. Keep the original capture before touching anything.
2. **Capture both sides comparably.** Same viewport (1440×1000 and 393×851), same route, same signed-in
   venture, same data. **The live side is production** — fixtures are small, and every fault this rule
   exists to catch only appears at real size: ARCA's 73 tickets, its 1,773 run reports.
3. **Measure.** `scripts/visual-parity-diff.mjs`. Record the height.
4. **Look at both, as pictures.** Then get an unprimed opinion with `screenshot-critique`.
5. **Iterate until it matches, or say plainly where it does not and why.**
6. **Write the reading into `docs/design-conformance.md`.**

## The thing this exists to prevent

**The first approximation looks fine to the person who wrote it.** Every automated gate was green through
thirty tickets while the desk was five times its design height, because the tests asserted every section
was present, in the right order, with correct data — all of which was true.

**A screen can be entirely correct and completely unusable.** Only comparing it with the design, and
looking, finds that.

## When the design does not answer the question

Stop and ask. Do not default to the artifact when it is silent, and do not invent. Write it into
`docs/design-gaps-open.md` in the shape that file uses: what a founder sees today, why that is not
obviously right, and what a ruling would settle. **Guessing at a design decision is how a screen acquires
an owner nobody chose.**
