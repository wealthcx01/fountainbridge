---
name: code-hygiene
description: Check changed code for names that no longer match reality, stale references to removed approaches, unnecessary guard logic, and comments that mislead. Use after implementing, before committing. Narrower than a full review — this is the tidiness pass, not the correctness audit. Adapted from dzhng/skills code-review.
---

# Code hygiene

Adapted from `engineering/code-review` in [`dzhng/skills`](https://github.com/dzhng/skills) (MIT).

## Why it is not called `code-review`

**It clashed with gstack's `/review`, and a duplicate is worse than an absence** — an agent offered two
skills with the same name picks one arbitrarily, and the arbitrary choice is invisible.

They are not the same job, so both survive under clear names:

- **`/review`** is the staff-engineer correctness audit, with an adversarial pass. Is this right? Does it
  hold up? Run it before a pull request.
- **`code-hygiene`** is this: names, stale references, needless guards, misleading comments. Run it after
  implementing, before committing.

Reach for `/review` when asking whether the change is *correct*. Reach for this when asking whether it is
*tidy*.

## 1. Names describe what a thing is, not what it used to be

If the mechanism changed, every name that referred to the old one changes with it. Would a new reader be
misled by this name?

## 2. No stale references

After a change, grep for the old approach: dead detection logic, abandoned flags, comments describing code
that is gone. **If something was tried and reverted, remove every trace.** The codebase should read as
though the current approach was always the plan.

## 3. Comments that have gone false are worse than no comments

This is the one this project has been bitten by, twice in one week:

- `VentureBoard.tsx` said *"every `ApprovalCard` below renders read-only"* — true when written, and by the
  time it was read there were **none below**. It made a weaker test look sufficient, and that test then
  looped over nothing and passed no matter what.
- A memory note recorded a diagnosis that was wrong, and the wrong version was believed for a week.

**A comment that names a count, a state or a file is a claim with an expiry date.** When the code moves,
either update the claim or delete it. Prefer explaining *why* over describing *what* — the what goes stale,
the why rarely does.

## 4. Guards that no longer guard

A check whose condition can no longer be false is noise pretending to be safety. Either it protects
something real, or it goes.

## 5. Written for the founder

Non-negotiable 12 covers code comments too. A comment is read by whoever arrives next, often at 23:00,
often not the person who wrote it. Short sentences, the plain word, and say what happened before what it
means.
