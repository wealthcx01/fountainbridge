---
name: screenshot-critique
description: Get an unprimed second opinion on a screen before claiming a visual change is verified or a visual bug is fixed. Use before saying any screen is right — the eyes that built it pass defects that fresh eyes catch. Adapted from dzhng/skills screenshot-critique.
---

# Screenshot critique

Adapted from `visual/screenshot-critique` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> Use an **unprimed** sub-agent as a second set of eyes before accepting visual work. **Primed eyes pass
> defects fresh eyes catch.**

## Why this is the same rule the lane already runs on code

The lane's `/review` stage runs as a **fresh `claude -p` with no `--resume`**, so it sees the diff and not
the reasoning that produced it. That is Cole Medin's hold-out critic, and FB-222 records that we implement
it by accident of how `claude_lane` is written.

**This is the same rule for screens, and we do not have it.** The person who just spent an hour on a layout
is the worst possible judge of whether it reads correctly, because they know what it is supposed to say and
their eyes supply it.

That is not a hypothetical here. Thirty tickets shipped with every gate green while the desk was 9,908px
against a design of ~1,900, and another screen printed the same sentence twenty times. Everyone involved
had looked at those screens. **They had all looked at them while knowing what they meant.**

## How it differs from `/design-review`

Both survive; they answer different questions.

- **`/design-review`** — is this screen good? Polish, hierarchy, whether it matches the design.
- **`screenshot-critique`** — is this specific claim about the screen true? Asked of someone who has not
  been told what the answer should be.

Reach for this one when you are about to write "verified" or "fixed" about something visual.

## The workflow

1. **Capture the exact images under review.** Not a description of them.
2. **Give the reviewer the image and the question, and nothing else.** No ticket, no diff, no "I changed
   the padding so check the padding". **The moment you say what to look for, they stop looking at anything
   else** — which is the whole failure being avoided.
   - Good: *"What is wrong with this screen?"*
   - Good: *"Can you read every row of this table?"*
   - Bad: *"I fixed the row spacing, does it look right now?"*
3. **Take the answer seriously even when it is about something else.** A fresh reviewer noticing a
   different problem is the value, not a distraction.
4. **Pair it with numbers when you need them.** `scripts/visual-parity-diff.mjs` (FB-226) measures; this
   judges. Neither replaces the other, and the numbers are the reason to look rather than a substitute for
   looking.

## When it is mandatory

**Before declaring any founder-reported visual problem fixed**, and before writing "verified" in a pull
request about a screen. Those are exactly the moments the eyes that did the work are least able to judge
it.
