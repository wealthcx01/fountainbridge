---
name: eval-skills
description: Test whether a skill actually works, by running it blind in a fresh agent against known cases and grading the result. Use when a skill keeps missing something, when adding or changing one, or to find out which of the borrowed skills are earning their keep. Adapted from dzhng/skills eval-skills.
---

# Eval skills

Adapted from `authoring/eval-skills` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> Treat a skill like a function under test… **The eval is only honest if the run is blind:** the agent
> executing the skill must carry none of this conversation's context and must never see the expected
> output. **Leak either and you are teaching to the test.**

## This is the third time the same rule has appeared

It is worth naming, because three independent sources have now arrived at it:

- **The lane's `/review`** runs as a fresh session with no `--resume`, so it judges the diff without the
  reasoning that produced it.
- **`screenshot-critique`** gives an unprimed reviewer the image and the question and nothing else.
- **This** runs a skill in a clean room and never shows it the expected answer.

**A judge that knows what it is supposed to conclude is not a judge.** Cole Medin's version is the blunt
one: *"a student grading their own homework."*

## Why it matters here specifically

We now hold **14 borrowed skills**, adapted rather than copied. Every adaptation is a place I changed
somebody else's judgement for reasons that seemed good at the time. **Nothing currently checks whether any
of them improved anything.**

Without this, the honest description of the last few hours is "fourteen instructions were added and nobody
measured them" — which is exactly the failure `auto-research` warns about: the appearance of rigour.

## The eval

1. **Write golden cases first**, before touching the skill: an input, and what good looks like. If you
   cannot say what good looks like, you cannot tell whether the skill helped.
2. **Run blind.** A fresh agent, no context from this conversation, never shown the expected output.
3. **Grade the artifact, not the transcript.** Did the thing it produced meet the case?
4. **Let the gaps drive the edits.** Change the skill, not the case — moving the goalposts to match the
   output is the same fault as a test written after the fact to match the bug.
5. **Re-run.** A fix that was not re-run is a hope.

## Where to start here

The skills with the clearest right answer:

- **`write-ticket`** — feed it a loose founder sentence; does the ticket have criteria someone else could
  check?
- **`plain-english`** — feed it a technical paragraph; could a founder act on the result without a
  follow-up question?
- **`audit-tests`** — feed it one of the **five vacuous tests this project has shipped**; does it catch it?
  That last one is the best case available, because the answer is already known and was expensive.
