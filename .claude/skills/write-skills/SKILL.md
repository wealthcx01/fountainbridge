---
name: write-skills
description: Create or revise a skill. Use when adding a skill, adapting a borrowed one, fixing a description that fires at the wrong time, or deciding what belongs in a skill rather than in a document. Adapted from dzhng/skills write-skills.
---

# Write skills

Adapted from `authoring/write-skills` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> A skill is **not documentation**. It is compressed operational memory for an agent that already knows how
> to code and reason. Its job is **predictability** — the agent taking the same *process* every run, not
> producing the same output.

That last distinction is the one to hold: **same process, not same output.**

## What belongs in a skill

**Only what changes what the agent will do.** If removing a paragraph would not change any decision, it is
documentation and belongs in `docs/`.

A skill should carry:

- **The judgement call**, stated plainly. "Decide which image is less wrong, not whether it matches."
- **The rule that is easy to get wrong**, and why. "Give the reviewer the image and nothing else."
- **What this project has actually paid for.** A rule with a scar attached is followed; a rule without one
  is skimmed.

## The description is the skill's trigger, and it is where most fail

The `description` decides whether the agent reaches for it at the right moment. A vague one never fires; a
broad one fires on everything.

Write it as **when to use this**, in the words that would appear in the situation:

- Bad: *"Helps with testing."*
- Good: *"Use when adding a test, writing a regression test, fixing a brittle or flaky one, or reviewing a
  test diff."*

## Adapting a borrowed skill

Every skill in this repository is adapted from `dzhng/skills` rather than copied, and the pattern is
consistent:

1. **Keep their judgement.** It is why the skill was worth taking.
2. **Replace their machinery.** Theirs assumed a `specs/` directory, a `web/` subdirectory, macOS Preview.
   Ours has tickets, a flat repository, and a Linux box.
3. **Attach our evidence.** The abstract rule is theirs; the five vacuous tests, the 9,908px desk and the
   35-second timeout are ours, and they are what make it stick.
4. **Credit the source**, and say what was changed and why.
5. **Settle any clash with a skill we already have**, by name and by job. Two skills with one job is worse
   than neither, because the choice between them is invisible.

## Before adding one

**Does one already exist?** There are fourteen. And is this a skill, or a note? A skill changes how work is
done every time; a note is read once.
