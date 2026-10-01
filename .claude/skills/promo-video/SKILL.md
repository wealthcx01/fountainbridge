---
name: promo-video
description: Make a promo or launch video for a venture, entirely in code with GSAP and three.js, judged by an independent critic loop against a measured quality bar. Use when asked for a promo, launch, ad, explainer or social video for a venture's product. Do NOT use before the product it promotes exists and works — check that first.
---

# Promo video

**John's brief for every promo video, set 2026-10-01.** It replaces the first attempt (FB-233), which
used almost none of what follows and was the wrong video to make at all. Use it as written.

## First, the question the first attempt never asked

**Does the product exist yet?**

A promo video goes *after* a product is built. ARCA's first one was made while ARCA was not built —
because the Foundry, the software factory that builds it, was not finished. A promo for something that
does not exist can only show invented screens and invented numbers, which this brief's own honesty
rules forbid.

So before anything below: confirm the product is real, working, and has something true to show. If it
does not, **stop and say so.** Building the capability is fine; making the film is not.

## The kit

Pinned to `echris6/motion-video-kit` at `255562b04b1e5ecaa4ba98e5c9aa191d5ba7f6fa` (MIT). Fetch it at that commit:

    git clone https://github.com/echris6/motion-video-kit.git /tmp/motion-video-kit
    git -C /tmp/motion-video-kit checkout 255562b04b1e5ecaa4ba98e5c9aa191d5ba7f6fa

Read `business-motion-film/SKILL.md` first, then each reference file **at the step where it says to
read it** — not all up front. Its rules, critic prompts, quality bar, three.js patterns, audio tools and
scripts **override your defaults**.

## What the first attempt got wrong — so it is not repeated

Recorded honestly, because each one is a rule below that was skipped:

| the brief requires | the first attempt did |
| --- | --- |
| a brief and a facts file | neither |
| studied references, contact sheets, motion notes | none studied |
| a storyboard of 12–15 compositions per 30s | one composition |
| the subject filling most of the frame | a ledger with large empty areas |
| GSAP, three.js for any 3D | hand-rolled SVG |
| an independent critic loop | judged its own work |
| 1080p at 60fps | 720p at 24fps |
| sound, measured loudness | silent |
| only facts-file numbers on screen, concepts labelled | **illustrative card prices, unlabelled** |

The last row is the serious one. Every other gap made a weaker film; that one made an untruthful one.

## The brief

<role>
you design and build motion videos entirely in code, with gsap for the animation and three.js for any
3d. every decision is judged against the best work in the references, and the video isn't finished
until it holds up next to them.
</role>

<brief>
- what the video is for: [product, service or business]
- who's watching: [who the viewer is and what they care about]
- what they should do at the end: [call to action]
- length and sizes: [e.g. 30 seconds, 16:9 and 9:16]
- brand: [name, logo files, colours, fonts]
- facts file: [path]. this is the only source for any number, name or claim that appears on screen
- assets: [footage, photos, screenshots, product files]
- style references: [links or a folder of videos whose motion i like]

i'm away and won't answer questions. make the calls yourself and keep going until the video passes
every check below.
</brief>

<kit>
before anything else, clone and read the kit above. read SKILL.md first, then every reference file it
points to at the step where it says to read it. its rules, critic prompts, quality bar, 3d patterns,
audio tools and scripts override your defaults.
</kit>

<setup>
- build every scene as an html page animated on a single gsap timeline, with three.js for any 3d, all
  as pinned local files
- render the timeline to video frame by frame using the renderer in the kit
- use ffmpeg for frames, contact sheets and audio measurement
- keep every api key in environment variables. never write a key into any file
- render a 5 second test first and confirm it works before building the real video
</setup>

<study_the_references>
if i gave you references, study them before planning anything.
- run a fast numeric pass over every frame: how much changed from the last frame, brightness and edge
  detail, to find every cut and every fast moment
- make one overview contact sheet per video, and a dense sheet of one second at 16 to 20 frames a second
  around every transition
- write a note per video: the key moment, how it works, and how it could be used in this video
- pull out the motion rules and named techniques that hold across the best ones
- references are for study only. never copy their footage, logos, layouts or music
if i gave you no references, use the motion notes in the kit.
</study_the_references>

<motion_principles>
1. the thing in the front of the shot becomes the transition. a title, logo or object moves towards
   the camera while the next scene is already waiting underneath
2. one object carries the story across shots and keeps its identity, so it reads as one continuous piece
3. one main movement leads, with smaller ones layered under it, all overlapping. the frame never stops
   and starts all at once
4. the speed always changes. things land slowly enough to read, leave fast, and the next thing slows as
   it arrives. no linear motion
5. cuts are allowed only when size, direction and subject match on both sides
6. every action produces a visible result. a scan makes findings, a tap makes a new state, a request
   makes a confirmation
7. type is motion too. big words enter from opposite sides, reveal the next scene, and never sit over
   busy picture without something behind them to stay readable
8. vary the scale from close, to wide, to overhead, to full-frame type. never repeat the same layout,
   like a heading over three cards
</motion_principles>

<storyboard>
write a brief and a storyboard before any animation.
- one table: time, what's on screen, what this moment is for, how it leaves, and which object carries
  into the next shot
- around 12 to 15 compositions per 30 seconds, each lasting about 1.4 to 3.5 seconds
- the main subject fills most of the frame. no small cards floating in empty space
- frame one is a finished picture, never a word halfway through flying in
- name three signature moments you can describe without using effect names
- the video must make sense with the sound off
- send the storyboard to a fresh critic and fix what it finds before building
</storyboard>

<build>
- every animated value is a function of timeline time only. no timers, no real-time animation, no
  unseeded randomness. any frame must render the same every time
- write the shared pieces first: colours, fonts, shared 3d models and the exact pixel position of every
  handoff between scenes
- build each scene as its own component with its own test page, rendered to stills and a short clip,
  and send it to a critic before it joins the film
- carried objects land on exactly the same pixels on both sides of a cut
- run several builders in parallel on separate sections once the shared pieces exist
- don't stop to ask for approval between steps
</build>

<critic_loop>
the builder never judges its own work.
- after the storyboard, each component and each full render, send the render, the brief and the
  references to a fresh critic that has seen none of the building
- never tell a critic what you think you fixed or what you believe about the references. it pulls its
  own frames and measures for itself
- the critic makes a contact sheet every 0.2 seconds plus dense frames around every transition,
  measures frozen time and loudness, and returns a ranked list of problems with timestamps, ending
  with ship or one more pass
- fix the biggest problem first, render, then send to a new critic that checks every previous item as
  fixed, partly fixed or still there, and hunts for anything new that broke
- keep a ledger of every round: what was found, what changed, and the numbers before and after
</critic_loop>

<quality_bar>
the video isn't done until all of these pass, measured:
- no more than about 1 second of frozen screen per 30 seconds, and no still stretch longer than about
  half a second
- frame one is a finished composition
- all text meets at least 4.5:1 contrast, and nothing collides with or flies through other text
- brand colours in 3d renders match the brand values
- loudness is steady and comfortable for web, with no clipping, and effects never louder than the music
- a first-time viewer understands it with the sound off
- a critic would put it next to the references without it looking weaker. a video with no bugs is not
  the same as a good video
</quality_bar>

<honesty>
- only put numbers, names and claims on screen that are in the facts file
- no invented testimonials, ratings, prices, savings, warranties or results
- anything conceptual or generated is labelled as such
- in your reports, separate what you measured from what still needs a human to watch or listen
</honesty>

<deliverables>
- the final mp4 in every size requested, at 1080p and 60 frames a second
- a music-only version
- a contact sheet of the final video
- the critic ledger and the final quality bar results
- a short note on anything a human should still check
</deliverables>

## Foundry rules on top of the brief

- **Posting is not part of this skill.** Putting a video on any network is an external action and
  waits on a recorded human approval (non-negotiable 4). This skill ends at a file and a draft post.
- **The heavy file is not committed.** Venture outputs live in `library/` with the binary in object
  storage and a pointer in git (D8).
- **The critic is a separate agent**, started fresh for each round, per the kit's Gauntlet. Use the Agent
  tool for it — this is one of the places this repository's instructions explicitly allow it.
