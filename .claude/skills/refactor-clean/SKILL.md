---
name: refactor-clean
description: Refactor by moving ownership until every concept has exactly one home, instead of layering a compatibility wrapper beside the problem. Use when a change reveals duplicated concepts, parallel abstractions, an over-large module, or "just tack this on" pressure. Adapted from dzhng/skills refactor-clean.
---

# Clean refactoring

Adapted from `engineering/refactor-clean` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

> Replace the old shape with the simpler shape the codebase would want if it were designed today.
> Refactoring is **not** adding a compatibility layer beside the problem; it is moving ownership until
> every concept has exactly one clear home.

It cuts both ways: merging duplicated owners into one, **and** splitting an overloaded module into the
several owners it was hiding.

## The rule this project keeps relearning

**A second copy is the one that drifts.** Every expensive fault here has that shape:

- Two deposit paths, one scanned and one not (FB-140).
- Two places an approval could be signed — the reason FB-183 exists and why a test now walks the whole tree
  to prove there is one.
- A SQL expression that existed in the code and again in its test, so the test checked the copy.
- A comment stating a count that the code had since changed.

So when a change tempts you toward "add another one beside it", that is the moment this skill is for.

## The workflow

1. **Name the concept that lacks one clear owner.** Not the file — the *concept*. "Who decides whether a
   read is stale?" is a concept. `lib/staleness.ts` is a file.
2. **Choose the owner it should have**, then move every caller to it. A refactor that leaves one caller
   behind has created a second copy rather than removed one.
3. **Delete the old path in the same change.** A compatibility wrapper kept "just for now" is the sediment
   this skill exists to prevent.
4. **Let the tests tell you whether ownership moved.** If nothing failed while you were mid-move, the tests
   were not testing the thing you moved.

## Where it stops

**Respect ticket scope** (non-negotiable 3). A refactor discovered while doing something else becomes its
own ticket, not a bigger pull request. The discipline is to write it down and carry on, and that is why
this repository has 230 tickets and a history nobody had to reconstruct.

A refactor that touches a screen is still a screen change: non-negotiable 11 applies, and
`compare-screenshots` is the instrument.
