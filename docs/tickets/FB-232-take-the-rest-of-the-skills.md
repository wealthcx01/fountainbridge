# FB-232 — take the rest of the skills, and settle the two that clash

**Status:** filed · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"why don't we include all the
skills?"* · **Follows:** D12, FB-226 · One ticket = one branch = one PR.

## Why this exists

D12 ruled that our agents load skills from `dzhng/skills` and named four to take. **One was built**
(`compare-screenshots`, FB-226) **and the rest were never filed.** That was a gap in delivery, not a
decision to leave them out, and John was right to ask.

## The honest count

**26 skills exist. We have 1.**

Checked against our own skills folder rather than assumed: **only two clash by name** — `codex` and
`review`, which gstack already provides. The other 23 fill gaps we have nothing for.

So "why not all of them" has a short answer: **most should come in.** The reason to do it as a ticket
rather than a copy is below.

## Why not simply copy all 26 in one go

Three real reasons, none of them a reason to stop:

1. **A skill is a behavioural instruction to the lane, not a library.** Twenty-three new instructions
   landing at once changes how the factory works in twenty-three ways, and if output quality drops there
   is no way to tell which one did it. They go in **in groups, each group its own PR.**
2. **Two clash, and a duplicate is worse than an absence.** We run gstack's `/review` and `/codex`. An
   agent offered two skills with the same job picks one arbitrarily, and the arbitrary choice is invisible.
   Each clash gets settled — theirs, ours, or a merge — and is never left as both.
3. **Function overlaps where names do not.** `write-spec` against our `/spec`, `audit-tests` against our
   `/qa-only`, `screenshot-critique` against our `/design-review`. Those need reading side by side, not a
   name comparison.

## The groups, in the order they earn their place

**Group 1 — the ticket loop.** `write-spec`, `close-spec`, `implement-spec`. This is the factory's core
loop and the most direct answer to "churn out code at scale": a ticket becomes a spec, the spec becomes
code, the spec is closed when it is met. Settle `write-spec` against `/spec` first.

**Group 2 — the quality gates.** `write-tests`, `audit-tests`, `code-review`, `refactor-clean`.
`audit-tests` matters most here: this project has found **five tests that could not fail**, and a skill
whose whole job is auditing tests is aimed squarely at that.

**Group 3 — the thinking tools.** `explore-unknowns`, `auto-research`, `audit-choices`, `eli5`.
`explore-unknowns` is a five-stage walk that ends by handing over a map, which is what a venture's first
week needs — that is FB-236's work and this group is its dependency. `eli5` is worth reading against
non-negotiable 12.

**Group 4 — the visual set.** `preview-shots`, `screenshot-critique`, `design-with-images`. Alongside
`compare-screenshots` these make non-negotiable 11 a toolkit rather than a rule. Settle
`screenshot-critique` against `/design-review`.

**Group 5 — writing and authoring.** `write-docs`, `marketing-pages`, `write-skills`, `eval-skills`.
`eval-skills` last and deliberately: once we hold a dozen borrowed skills, the ability to test whether one
is helping is what stops this becoming twenty-six instructions nobody measures.

**Not in scope here:** `launch-video` and `renderer` are FB-233. `audit-performance` waits until something
is slow enough to point it at. `claude` and `implement-spec-with-codex` are harness-specific and need
reading before they are wanted.

## Scope

- One PR per group, in the order above.
- Each skill **adapted, not pasted.** FB-226 is the precedent: their `compare-screenshots` assumed a
  `web/` directory this repo does not have, so the thinking was theirs and the file handling ours. Expect
  the same for anything that touches paths or tooling.
- Every clash settled explicitly in the PR that touches it, with one skill left standing.
- Each skill's `description` written so the lane picks it up for the right ticket and not others — that is
  how "loaded depending on the ticket" actually works, and a vague description is a skill that never fires
  or always does.
- Credit `dzhng/skills` (MIT) in each adapted file.

## Out of scope

- Changing the lane's own stages. Skills change how a stage works, not what the stages are.
- `launch-video` / `renderer` (FB-233), the founding research loop (FB-236), `duet-agent` (FB-238).
- Removing any gstack skill. A clash is settled by choosing which one the lane reaches for, not by
  deleting the other.

## Acceptance criteria

- [ ] Each group lands in its own PR, with its own before-and-after on the lane's behaviour where that can
      be observed.
- [ ] No two skills in the tree have the same job. The clashes on `review` and `codex` are named and
      resolved.
- [ ] `write-spec` versus `/spec`, `audit-tests` versus `/qa-only`, and `screenshot-critique` versus
      `/design-review` are each read side by side and the choice written down.
- [ ] Every adapted file credits its source and says what was changed and why.
- [ ] A skill that reads paths or runs a script is proved to work **in this repo**, not assumed from its
      documentation.
- [ ] `eval-skills` is in place before the count passes a dozen, so a borrowed skill that is not helping
      can be found.

## Verification

Any skill touching a screen is verified per non-negotiable 11, with `compare-screenshots` as the
instrument. A skill whose only evidence is "it is installed" has not been verified: the test is that the
lane reaches for it on the right ticket and produces something better than it did before.
