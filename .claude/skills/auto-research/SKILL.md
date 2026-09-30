---
name: auto-research
description: Run fast progressive experiments to find what actually moves a number, when there is a goal that can be measured. Use for optimising against a benchmark or a scored set. Not for answering an open question about a venture. Adapted from dzhng/skills auto-research.
---

# Auto research

Adapted from `engineering/auto-research` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> Optimise **learning per unit of time.** Start with one fast, revealing task, plan competing hypotheses,
> test them separately, combine verified winners, then expand coverage. **An experiment is a checkpoint,
> not a stopping point.**

## Be honest about when this applies here

**It needs a number that can be scored.** Most questions on this project are not that shape: "should we use
Buzz", "what does an empty office look like", "what is a founder's first ticket" are judgement, taste and
conversation. Reaching for this on those produces the appearance of rigour and nothing else.

**Where it genuinely fits:**

- **FB-237's golden question set.** A set of questions about a venture whose answers we already know, run
  against the brain, scored. That is exactly a benchmark, and the workshop this came from moved from 16/26
  to 23/26 by treating it as one.
- **Anything with a before-and-after measurement.** The read model went from 61 requests to 1. The approval
  page went from a 35-second timeout to 669ms. Those were single changes; when there are competing ways to
  do one, this is the discipline for choosing.
- **Prompt and skill changes**, once `eval-skills` exists to score them.

**Where it does not fit:** deciding what to build, what a screen should show, or whether a dependency is
worth taking.

## The loop

1. **One fast, revealing trial first.** If the first experiment takes a day, the plan is wrong.
2. **Competing hypotheses, tested separately.** Two changes at once and you have learned nothing about
   either — which is exactly why FB-232 lands the skills in groups rather than all at once.
3. **Combine only verified winners.**
4. **Record the parameter-effect map**, not just the winner. The map is what stops the next person
   re-running your experiments.

## The rule that matters most

**Record the first score even when it is bad.** A baseline nobody likes is still a baseline, and without
one every later number is an opinion. This project has said "it is faster now" more than once without being
able to say faster than what.
