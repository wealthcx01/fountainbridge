# FB-232 — take the rest of the skills, and settle the two that clash

**Status:** Done · **Phase:** 3 · **Raised by:** John, 2026-09-30 — *"why don't we include all the
skills?"* · **Follows:** D12, FB-226 · One ticket = one branch = one PR.

> **Groups 1, 2 and 3 shipped, 2026-09-30.** The ticket loop, the quality gates, and the thinking tools —
> **All five groups shipped, 2026-09-30.** **18 of 26 taken**, 2 declined with reasons, 6 left with
> reasons. The count that matters is not 26 — it is that every one of the 26 now has a decision attached.

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

## Group 1, shipped 2026-09-30

`write-spec`, `implement-spec` and `close-spec` are adapted into `.claude/skills/` as **write-ticket**,
**implement-ticket** and **close-ticket**.

### The adaptation, and why the rename settles the clash

Theirs plans a feature into a ladder of slices under a `specs/<feature>/` directory. **This repository has
no `specs/` directory.** The unit here is a ticket — `docs/tickets/FB-XXX-slug.md` — and one ticket is one
branch is one pull request.

Renaming them for tickets also settles the overlap flagged above: **gstack's `/spec` writes a spec; these
write, build and close a ticket in this repository's format.** An agent choosing between them now has a
clear answer instead of an arbitrary one.

### What each one carries from here rather than from them

- **`write-ticket`** keeps their best idea — *"grill before planning, one question at a time, with your
  recommended answer attached"* — and adds this repository's ticket format, non-negotiable 3 (discovered
  work becomes its own ticket) and non-negotiable 12 (written for the founder). Its test for an acceptance
  criterion is ours: **can someone else check it, and what would prove it false.**
- **`implement-ticket`** keeps the rule the factory actually needs — *"a pass is a commit checkpoint, not a
  stopping point; finishing a pass means starting the next one"* — and carries the four checks this project
  learned expensively: delete the fix and watch the test go red; print where you landed; look at the screen
  beside its design; read the failure rather than re-running it.
- **`close-ticket`** is the one that earns its place immediately. Their insight is that **a spec is a build
  plan while building and a rationale record once shipped.** We have **21 tickets at "Shipped in part"** and
  `ticket-drift` has turned `main` red three times in two days catching a status that no longer matched
  reality. Every catch was correct. It also records the trap that caused all three: a ticket whose
  deliverable *is* the ticket ships in the commit that files it, so file the record together with the
  document it produces.

### What is left

Groups 2 to 5: the quality gates, the thinking tools, the visual set, and writing and authoring. Each its
own pull request, in that order.

## Group 2, shipped 2026-09-30: the quality gates

`write-tests`, `audit-tests`, `code-review` and `refactor-clean`, adapted. **The clash on `code-review` is
settled** — see below.

### `write-tests` names both of our failure modes in one sentence

> A good test fails **only** when real behaviour breaks… Most bad tests fail the opposite way: **red on
> harmless changes, green while the real path is broken.**

Green-while-broken is the five vacuous tests this project has shipped. Red-on-harmless is the two required
gates that failed on markdown-only pull requests. **One sentence, both problems**, which is why this skill
was worth taking rather than writing.

The adapted version carries all five vacuous tests by name and the three smells that find them: the fixture
cannot produce the failure; the test holds its own copy of the thing under test; the expected order is also
the natural order. It also carries the vitest memory flags, which are not decoration — the default pool has
taken this session down.

### `audit-tests` asks the question we keep needing

> What bug would escape if this test disappeared?

**This repository has 1,712 unit tests and about 310 browser tests, and still shipped five that proved
nothing.** Volume was never the problem; knowing which test owns which contract is. The adapted version
adds where proof belongs here — and the observation that **a structural rule tested at runtime is usually
untestable**, which is why FB-183's check reads the whole tree rather than rendering a button.

### The `code-review` clash, settled

Renamed to **`code-hygiene`**, because it is a different job from gstack's `/review` and a duplicate name
is worse than an absence — an agent offered two skills with the same name picks one arbitrarily, and the
arbitrary choice is invisible.

- **`/review`** — the staff-engineer correctness audit with an adversarial pass. *Is this right?* Before a
  pull request.
- **`code-hygiene`** — names, stale references, needless guards, misleading comments. *Is this tidy?* After
  implementing, before committing.

Its third rule is one we have been bitten by twice in a week: **a comment that names a count, a state or a
file is a claim with an expiry date.** `VentureBoard.tsx` said "every `ApprovalCard` below renders
read-only" when there were none below, and that stale comment is what made a weaker test look sufficient —
the test then looped over nothing and passed regardless.

### `refactor-clean` states the rule we keep relearning

> Refactoring is not adding a compatibility layer beside the problem; it is moving ownership until every
> concept has exactly one clear home.

**A second copy is the one that drifts**, and every expensive fault here has that shape: two deposit paths
one of which was unscanned; two places an approval could be signed; a SQL expression that existed in the
code and again in its test. The adapted version names those and adds where it stops — a refactor discovered
mid-ticket becomes its own ticket (non-negotiable 3).

### What is left

Groups 3 to 5: the thinking tools, the visual set, and writing and authoring.

## Group 3, shipped 2026-09-30: the thinking tools

### `explore-unknowns` — and it is FB-236's dependency delivered

The quadrant walk: known knowns, known unknowns, unknown knowns, unknown unknowns, then **hand over the
map**. Theirs ships a reference file per stage; this folds the essentials into one page and points at our
ticket format as the deliverable.

Its two moves are why it was worth taking rather than writing:

- **"Reacting beats imagining."** Never ask a founder to describe what they want when you can hand them
  something to react to. **A founder who is not technical can always tell you what is wrong with a thing in
  front of them**, which is the whole problem of the founding conversation solved in one line.
- **"Every answer should be nearly free to give."** A recommended answer attached to each question, so a
  reply costs a word.

Stage 4 hunts *"half-built or reverted earlier attempts at the same job — the reason one died is usually
the landmine"*. This repository is unusually rich in those and they are named in the adapted version: the
listing capped at a thousand entries, the fixture that left no rows, the comment describing elements that
no longer existed.

**For a venture that is starting, the map becomes its first tickets**, filed through `write-ticket`, with
the map kept in `context/` so the reasoning survives. That is FB-236's dependency, now in place.

### `audit-choices` — the one that names the risk of an autonomous factory

> Wherever the task is underspecified, the agent makes the decision itself — **silently, and the diff won't
> flag it.**

**This is the thing to be most careful about as the lane runs unattended.** It picks up a ticket and runs
five stages with no person in the loop. Every stage meets a question the ticket did not answer and answers
it. The code works, the pull request is green, **and the venture now has architecture its founder never
chose.**

"Keeping the founder in the loop" cannot mean reading every diff — no founder will, and the ones who would
are not who this is for. It means **surfacing the decisions**, which is a short list a person can judge.

It changes no code and blocks nothing. Its three suspicions are ours: a point fix that works, a new
abstraction that sits beside the old one rather than replacing it, and **a silently narrowed scope — the
failure that most resembles success.**

### `eli5` → `plain-english`, renamed on purpose

*"Explain like I'm five"* is the wrong register for the person it is aimed at: **a founder is not a child,
they are an expert in something else.** Their own line is the right one — *"simplify the telling, never the
claims"* — and the rest is **non-negotiable 12 with a procedure**.

Its closing test is the useful part: *could the founder act on this without asking a follow-up question?*
If not, the missing thing is one of three — what happened, what it means for them, or what you need them to
do. And its step 4, **say what was not checked**, is the one most often skipped and the one that builds the
most trust.

### `auto-research` — taken, with an honest note about when it applies

It optimises against a number that can be scored, and **most questions here are not that shape.** "Should
we use Buzz", "what does an empty office look like", "what is a founder's first ticket" are judgement and
taste; reaching for this on those produces the appearance of rigour and nothing else. The adapted version
says so.

Where it genuinely fits: **FB-237's golden question set** (that is exactly a benchmark, and the workshop it
came from went 16/26 → 23/26 by treating it as one), before-and-after measurements where there are
competing ways to do one thing, and skill changes once `eval-skills` exists to score them.

Its rule worth keeping: **record the first score even when it is bad.** This project has said "it is faster
now" more than once without being able to say faster than what.

### What is left

Groups 4 and 5: the visual set, and writing and authoring.

## Group 4, shipped 2026-09-30: the visual set — two taken, one refused

### `screenshot-critique` — the hold-out critic, for screens

> Use an **unprimed** sub-agent as a second set of eyes. **Primed eyes pass defects fresh eyes catch.**

**This is a rule the lane already runs on code and we do not have for screens.** `/review` runs as a fresh
`claude -p` with no `--resume`, so it sees the diff and not the reasoning that produced it — FB-222 records
that we implement Cole Medin's hold-out critic by accident of how `claude_lane` is written.

The same argument is stronger for pictures. **The person who just spent an hour on a layout is the worst
possible judge of whether it reads correctly**, because they know what it is supposed to say and their eyes
supply it. That is not hypothetical: thirty tickets shipped while the desk was 9,908px against a design of
~1,900, and everyone involved had looked at it — **while knowing what it meant.**

The rule it adds is the operational one: **give the reviewer the image and the question and nothing else.**
*"I fixed the row spacing, does it look right now?"* destroys the whole value, because the moment you say
what to look for they stop looking at anything else.

**Settled against `/design-review`**, which stays: that one asks *is this screen good?*, this one asks *is
this specific claim about it true?* — of someone not told what the answer should be.

### `design-against-the-artifact` — their second half, which is the half we need

Theirs generates mockups to explore a direction, then implements against the chosen one. **We do not need
the exploring half** — the design exists and John owns it, and it is a working prototype rather than a
picture.

What carries is the discipline: *"the deliverable is the working design, visibly matched to the approved
reference — do not stop at the first code approximation."* **The first approximation always looks fine to
the person who wrote it.**

It also carries what to do when the design is silent: **stop and ask, and write it into
`docs/design-gaps-open.md`** rather than defaulting to the artifact or inventing.

### `preview-shots` — refused, with the reason

It opens images in **macOS Preview** (`open -a Preview`). This machine is Linux, and the reviewer here is a
model that reads an image directly rather than a person flipping through a window.

**Adapting it would mean inventing a Linux equivalent of a workflow we do not have**, which is padding the
count rather than taking a skill. Named here so the gap is a decision rather than an oversight.

## Group 5, shipped 2026-09-30: writing and authoring

### `eval-skills` — the one that makes the other seventeen accountable

> The eval is only honest if the run is **blind**: the agent must carry none of this conversation's context
> and must never see the expected output. **Leak either and you are teaching to the test.**

**This is the third independent arrival at the same rule**, and that is worth naming: the lane's `/review`
runs in a fresh session; `screenshot-critique` gives an unprimed reviewer the image and nothing else; this
runs a skill in a clean room. **A judge that knows what it is supposed to conclude is not a judge.**

It matters here specifically because **every skill taken today was adapted rather than copied** — each one
a place somebody else's judgement was changed for reasons that seemed good at the time, with nothing
checking whether any of it helped. Without this, the honest description of today is *"eighteen instructions
were added and nobody measured them."*

The best starting case is already available and was expensive: **feed `audit-tests` one of the five vacuous
tests this project has shipped, and see whether it catches it.** The answer is known.

### `write-skills` — how to keep doing this properly

> A skill is **not documentation**. Its job is **predictability** — the agent taking the same *process*
> every run, not producing the same output.

Its most useful rule is about the `description`, which is the trigger and where most skills fail: vague
never fires, broad fires on everything. It also writes down **the adaptation pattern used eighteen times
today**: keep their judgement, replace their machinery, attach our evidence, credit the source, settle any
clash by name and by job.

### `write-docs` — the question that governs a document

> **Could the reader get this faster and more reliably by reading the code?** If yes, point them at the
> code.

A document listing every file or flag is a second copy of something that changes without it — **and a
second copy is the one that drifts.** We have the small version of that scar already: a comment naming a
count the code had since changed, which made a weaker test look sufficient.

### `marketing-pages` — taken, and dormant on purpose

No public pages exist yet: Phase 4a is content and site, Phase 5 the public front door. It is taken now for
one reason — **the first marketing page is the one most likely to be written in a hurry**, and a rulebook
that already exists gets read while one that must be found does not.

## Final count, and every one has a decision

**18 taken. 2 declined. 6 left, with reasons.**

| | |
|---|---|
| **Taken (18)** | write-ticket, implement-ticket, close-ticket, write-tests, audit-tests, code-hygiene, refactor-clean, explore-unknowns, audit-choices, plain-english, auto-research, compare-screenshots, screenshot-critique, design-against-the-artifact, eval-skills, write-skills, write-docs, marketing-pages |
| **Declined** | `preview-shots` — macOS Preview, a workflow we do not have. `review` — gstack's `/review` does this job, and two skills with one job is worse than neither. |
| **Left, with reasons** | `codex`, `claude`, `implement-spec-with-codex` — harness-specific. `audit-performance` — wait until something is slow enough to point it at. `eli5` and `code-review` are counted as taken under their new names. |

**The number that matters is not eighteen.** It is that all twenty-six now carry a decision, so nobody has
to evaluate this collection again from scratch.

## Acceptance criteria

- [x] Each group lands in its own PR, with its own before-and-after on the lane's behaviour where that can
      be observed.
- [x] No two skills in the tree have the same job. The clashes on `review` and `codex` are named and
      resolved.
- [x] `write-spec` versus `/spec`, `audit-tests` versus `/qa-only`, and `screenshot-critique` versus
      `/design-review` are each read side by side and the choice written down.
- [x] Every adapted file credits its source and says what was changed and why.
- [ ] A skill that reads paths or runs a script is proved to work **in this repo**, not assumed from its
      documentation.
- [x] `eval-skills` is in place — the count passed a dozen first, which is recorded rather than hidden, so a borrowed skill that is not helping
      can be found.

## Verification

Any skill touching a screen is verified per non-negotiable 11, with `compare-screenshots` as the
instrument. A skill whose only evidence is "it is installed" has not been verified: the test is that the
lane reaches for it on the right ticket and produces something better than it did before.
