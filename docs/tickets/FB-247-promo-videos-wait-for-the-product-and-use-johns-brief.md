# FB-247 — promo videos wait for the product, and are made to John's brief

**Status:** Done · **Phase:** 4 · **Raised by:** John, 2026-10-01 · One ticket = one branch = one PR.

## Why

FB-233 produced a launch video for ARCA. John's review:

> *"It could be a lot better. It's meant to be a promo video after all? are you using the skill to the
> full extent? But also a promo video would go after a product is built, currently arca is not built,
> because foundry studio our software factory is not done being built. In future use this prompt for
> promo videos."*

Three findings, all his and all correct:

1. **A promo belongs after the product exists.** ARCA is not built, so its promo could only show
   invented things.
2. **The kit was barely used.** One composition, no sound, no critic, 720p at 24fps.
3. **The first film put unlabelled illustrative numbers on screen**, which the kit's truth rule and
   John's brief both forbid outright.

## What this ships

**`.claude/skills/promo-video/SKILL.md`** — John's brief, verbatim, as the operating instructions for
every future promo video. Kept as a skill rather than a note in a conversation because a note in a
conversation is gone by the next one, and this needs to be the thing that happens by default.

On top of the brief, three things the brief does not say and the Foundry needs:

- **It opens with "does the product exist yet?"** — and stops if not. That is the question FB-233 never
  asked, and it costs one sentence to ask.
- **The kit is pinned** to `echris6/motion-video-kit` at a specific commit (MIT). The brief says "all as
  pinned local files"; a kit fetched from a moving branch is not pinned.
- **A table of what the first attempt got wrong**, row by row against the brief. Recorded so the next
  attempt can see the gap rather than rediscover it.

Posting stays out of the skill entirely: it is an external action behind the approval gate.

## Acceptance criteria

- [x] John's brief is saved where it will be used by default, not in a chat transcript.
- [x] It refuses to make a promo for a product that does not exist yet.
- [x] The kit it depends on is pinned to a commit.
- [x] FB-233 is parked, with the reasons recorded rather than the ticket quietly abandoned.
