# FB-233 — Scale: a launch video a founder can post, and the gate that stops us posting it

**Status:** filed · **Phase:** 4 · **Raised by:** John, 2026-09-25 and again 2026-09-30 · **Follows:**
D12 · One ticket = one branch = one PR.

## What a founder should get

A venture reaches something worth announcing. The Foundry produces **a finished launch video from the
venture's own repository and brand**, and the draft post to go with it. The founder watches it, and presses
send themselves.

## Why two skills and not one

John was right and my first note was too dismissive.

- **`launch-video`** makes the piece: it reads the README, docs and brand art, finds the story, and builds
  picture and score off one timing source. Its own bar is a showreel, and its rule is that *if the piece
  could be re-skinned for any other project, it has failed.*
- **`renderer`** is how it gets drawn — architecture rules for GPU rendering, plus Blender scripts kept in
  the repo so every asset is reproducible from code rather than hand-edited.

So `renderer` is not a Scale capability on its own. **It is what keeps `launch-video` from becoming a pile
of one-off canvas code**, which matters the second time we make a video rather than the first.

## Where the brand comes from

`context/` in the venture repo already holds the brand kit (D8). The video is made from **what the venture
actually is**, not from a template. A launch video that could belong to any venture is the failure
`launch-video` names itself.

## Where it stops, and this is deliberate

**The Foundry can make the video end to end. It cannot post it.**

A video is an artifact. Putting it on X or LinkedIn is an **external action**, and non-negotiable 4 says
nothing external happens without a recorded human approval. The ratified GTM research goes further: LinkedIn
is agent-drafted and **human-sent**.

So what a founder gets is: *"here is your launch video, here is the post I would make, press the button."*
Neither skill covers the posting half — that is ours, and it is a separate ticket that inherits the approval
gate rather than working around it.

## Scope

1. Adapt `launch-video` and `renderer`, crediting `dzhng/skills` (MIT).
2. Make one real video for ARCA from ARCA's own repository and brand. **One real output beats a working
   pipeline with nothing in it.**
3. Store it where venture outputs live (`library/`, per D8), with the heavy file in object storage and a
   pointer in git.
4. Draft the post alongside it, as a proposal that waits for a person.

## Out of scope

- Sending anything. That is the approval gate's work and its own ticket.
- Social accounts, tokens or scheduling. None of that is needed to make a video, and adding it here would
  put credentials next to a rendering pipeline for no reason.
- Video for the studio itself. This is a venture capability.

## Acceptance criteria

- [ ] One finished video exists for ARCA, made from ARCA's repository and brand, and John has watched it.
- [ ] It could not be re-skinned for another venture without being obviously wrong.
- [ ] Every asset is reproducible from code in the repo — no hand-edited file with no source.
- [ ] The draft post exists and **nothing can send it** from inside the Foundry.
- [ ] The video is in `library/` with a pointer in git, not a binary committed to the repo.

## Verification

The video is the verification, and it is watched. A rendering pipeline that produces a technically valid
file nobody would post has failed, and only looking tells you that — the same reason non-negotiable 11
exists for screens.


## John's review, 2026-10-01: parked, and rightly

> *"It could be a lot better. It's meant to be a promo video after all? are you using the skill to the
> full extent? But also a promo video would go after a product is built, currently arca is not built,
> because foundry studio our software factory is not done being built."*

**Both points are correct, and the second one is the more important.**

### The film should not have been made yet

A promo video goes after a product exists. ARCA is not built, because the Foundry that builds it is not
finished. This ticket asked for "one real output" and that was treated as the goal without anyone
asking whether that output should exist yet. A promo for something unbuilt can only show invented
screens and invented numbers.

### It did not use the skill

`launch-video` and `renderer` were adapted loosely. The motion kit John points to
(`echris6/motion-video-kit`) asks for a brief, a facts file, studied references, a storyboard of 12–15
compositions, GSAP and three.js, sound, an independent critic loop and a measured quality bar. This
film had one composition, no sound, no critic, and was judged by the agent that built it.

### And it broke the kit's first rule

The card prices on screen — the ledger's four figures — are **not ARCA's data** and nothing on screen
said so. The kit's first non-negotiable is truth, and John's brief says *"only put numbers, names and
claims on screen that are in the facts file"* and *"anything conceptual or generated is labelled as
such"*. This film did neither. Every other gap made it weaker; that one made it untruthful.

### What survives

The rendering approach — every frame a pure function of time, nothing hand-edited, the whole thing
diffable — is sound and is what the kit also requires. The scene and its tests stay in the repository
as a working example of that, and **not** as ARCA's promo.

### What replaces it

**FB-247**: the `promo-video` skill, which carries John's brief verbatim, pins the kit, and opens with
the question this ticket never asked — *does the product exist yet?*
