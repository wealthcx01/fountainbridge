# ARCA — launch video

The finished file is **not in this repository**. D8: heavy binaries live in object storage with a
pointer in git, and a 13-second H.264 file is a binary that would be committed again on every re-cut.

## What it is

A 13.5-second launch piece for ARCA, built from ARCA's own repository: its brand positioning
(`context/sell/arca-brand-positioning.md`), its design rationale (`docs/brand/design-rationale.md`)
and its own brand mark (`client/src/components/ui/Logo.tsx`).

    1280 × 720 · 24 fps · 13.5s · H.264 / yuv420p · ~157 KB

## How to make it

    node scripts/launch-video/render.mjs library/launch-video

Deterministic: the same command produces the same file. Nothing in it was hand-edited and there is no
source asset that is not code — `scene.mjs` computes every frame as SVG, Chromium rasterises it, and
ffmpeg encodes it.

## What it is about

ARCA's brand document states one rule more plainly than any other:

> Gold is a signal, not a decoration. If gold shows up, it means ARCA has proven something about that
> row of data.

So the film **enacts** that rule rather than illustrating it. It runs in near-black and warm parchment
with no gold at all while the ledger fills and the score climbs. The score stalls at 79. Gold arrives
on the single frame it reaches 80, and nowhere before it.

That is why this piece could not be re-skinned for another venture: without a score, a threshold and
a rule about what the accent colour means, the structure has nothing to be about.
`lib/__tests__/launch-video.test.ts` checks it frame by frame.

## Where the file is

**Not yet in object storage.** The studio has a `DOCUMENT_STORE` for the venture's documents; wiring
a video into it is its own piece of work and is not folded in here. Until then the file is produced
on demand by the command above, and the copy John was sent came from that command.

Stated plainly rather than left blank: this criterion of FB-233 is **not met**.
