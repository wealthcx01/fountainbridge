# FB-242 — "What happened" says *everything* over a read that stopped at twenty

**Status:** Open · **Phase:** 3 · **Found by:** FB-175's sweep on real data, 2026-09-30

## What a founder sees

ARCA's "What happened", on its own data, at 1440×1000. The whole screen:

> **What happened**
> Everything ARCA did **since 30 September 2026**, newest first. Sent, failed, refused: it stays
> here with its state.
>
> Today 21:35 · Stopped on ARCA-055 … parked until tomorrow. · 20 times

**One row.** The date in that sentence is today. ARCA has **9,889 run reports** going back five
weeks, and this page positively tells its founder that everything the venture did began this
morning.

There is no caveat anywhere on the screen. 800 of its 1,000 pixels are empty.

## Why

Three things compound, and each is individually defensible:

1. **The read stops at twenty.** `loadRunReports` takes `limit = 20`, so the page only ever sees the
   twenty newest reports out of 9,889.
2. **Those twenty collapse to one.** They are all the same park — "team budget reached, parked until
   tomorrow" — and `collapseRepeats` correctly merges them into a single row saying "20 times".
3. **So the page concludes it did not truncate.** `buildFeed` returns
   `truncated: kept.length < items.length`. One item was built and one was kept, so `truncated` is
   false and the *"Showing the 20 most recent"* footer never renders.

`buildFeed` can only report the truncation **it** performed. It is blind to the much larger cut that
happened upstream, before it was called. And `oldest` — the date in that sentence — is read off the
last item of the truncated window and presented as the beginning of the venture's history.

The code even carries a comment saying the opposite is true: *"the record below also carries runs and
decisions, which have no window at all."* That was true when it was written.

## Why it matters

Non-negotiable 10: a founder must never be misled about what their team did. This is the most direct
breach of it in the studio — not a screen that fails to say something, but one that **asserts
completeness it does not have**, on the screen whose entire job is to account for the work.

It is also the same family as the 1,000-report cap in `docs/`: a bounded read rendered as a whole
picture.

**The studio already knows how to say this properly, two screens away.** A ticket's trail says:

> Part of this history could not be read, so it may be short. **It is not that nothing else happened
> — it is that the studio could not see it.**

That is exactly the right sentence. "What happened" should not be able to say less than a ticket does.

## Scope

- A page that reads a window must say so **from the window, not from what survived it**. The honest
  sentence needs the count it read and the count that exists — both are already known at the call
  site (`total` comes back from `loadRunReports`).
- Fix the false date: `oldest` may only be called the start of history when the read reached the
  start of history. Otherwise it is "the oldest thing shown", which is a different sentence.
- Decide what this screen should do with a venture whose recent history is one repeated line. Showing
  one row over 9,889 reports is truthful about the last twenty and useless about the five weeks. The
  desk solved its version of this by saying the repeat count out loud; this screen needs its own
  answer, and it is the screen a founder opens to ask "what has been going on?"
- A test that fails when a page renders a bounded read without stating the bound.

## Acceptance criteria

- [ ] No screen states a date as the start of history unless the read reached it.
- [ ] "What happened" says how much it read and how much exists, whenever those differ.
- [ ] Over ARCA's real data the screen is useful — a founder can tell that five weeks of work
      happened, not that the venture began today.
- [ ] A test fails if a bounded read is rendered without its bound stated.

## Notes

Found by running `scripts/measure-on-real-data.mjs` across every screen and **looking at the
pictures**. Every automated gate was green. The page renders, in the right order, with correct data —
correct about the twenty reports it read, and wrong about the venture.

This is the third time that exact sentence has been written in this repo (FB-124, FB-178, now this).
