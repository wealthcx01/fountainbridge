# FB-202 — the office in Bruntsfield's colours

**Status:** Done · **Phase:** 3 · **Raised by:** John, 2026-09-07

## What John asked for

> use the editor to design the pixel agent more in line with Bruntsfield Capital

## What the room is made of

pixel-agents draws a 21×22 grid. Each tile carries a **colour adjustment** rather than a colour —
`{h, s, b, c}`, a hue to rotate to and shifts for saturation, brightness and contrast. So this is not
repainting the art. It is telling the same art which house it lives in.

It ships blue: hues 209 and 214 for the walls and the meeting room, 25 for the timber. Blue is the
one that has to go, because it is the only colour in the room that says *somebody else's brand*.
Bruntsfield is `#1a3b26` — a very dark, nearly grey green — with warm paper and near-black ink.

## Three attempts, and the two wrong ones are the useful part

**Rotate the hue and keep everything else.** A bright snooker-table green: exactly as loud as the
blue had been, wearing a different coat. Rotating a hue does not change how much colour is in a room.

**Push saturation negative to calm it.** The room came out **mauve**. Every saturation value
pixel-agents itself ships is positive (`{h:280,s:40,…}`, `{h:209,s:39,…}`), and a negative one is
outside what its renderer is built for — it wrapped rather than desaturating.

That was two guesses about somebody else's colour model in a row, so the third move was to stop
guessing and read the bundle. The fix that follows from reading it is one line: **desaturate by
moving `s` down towards zero, and never past it.**

The result is a muted sage room, warm timber, near-black walls. Green enough to be ours, quiet
enough to sit under a founder's work rather than in front of it.

## Where it lives, and why not on the box

`~/.pixel-agents/layout.json` — **outside** `node_modules`, deliberately. `provision-office.sh`
reinstalls the pinned office package, so a layout edited inside the package would be silently
overwritten on the next provision, and the room would go back to blue with nobody able to say when.
The loader prefers a saved layout over the packaged default, so this is the supported seam.

The room and the recipe that produced it are both in `deploy/office/`, and provisioning installs the
room. A future venture gets it without anyone remembering to.

## What this does not fix

**The furniture is still pink.** The sofas and benches are sprites, not tiles, so no tile colour
reaches them. Recolouring those means touching the sprite sheets, which is a different and larger
job — and one worth doing only once John has looked at the room, because it is the sort of change
that is easy to do twice.

## Heights

Not applicable — nothing about the studio's own screens changed. The office frame is the same size
it was in FB-192; only what is inside it looks different.
