# FB-222 — Cole Medin: the four things we have not taken, and the one we already do

**Status:** Todo · **Rewritten** 2026-10-07 by the October re-baseline (`docs/status/2026-10-re-baseline.md`) · **Phase:** 3 · **Raised by:** John, 2026-09-25 — *"look at Cole Medin and how we
have used him in other projects on this VM… That should help improve our memory and how we develop when
we implement his principals."* · **Branch:** `fb-222-cole-medin-principles` ·
One ticket = one branch = one PR.

> **Rewritten 2026-10-07: Archon is Cole Medin's own project, and the factory now runs on it.** So we
> are no longer choosing which of his ideas to take one by one; we have taken the biggest one whole — a
> process written down as steps, with the AI filling in each step (Cowgate, CG-0009 and CG-0010). What
> that does to the four takes below:
>
> - **Take 1, the fire budget, stays here.** It is a rule about how often the *studio* may say the same
>   thing to a founder. Archon does not touch it.
> - **Take 2, inverting the lane's 41 "do not" instructions, moves.** If FB-264 retires the lane, its
>   prompts go with it. The same audit belongs on the prompts in Cowgate's house workflow
>   (`bruntsfield-ticket`), as a Cowgate ticket.
> - **Take 3, a composer with no tools, folds into FB-144**, which now decides what the composer is for.
> - **Take 4, fix the system and not the bug, is already how we work.** A written workflow makes it
>   cheaper: a lesson becomes one edit to one file and one test, instead of a change copied to every box.
> - **The hold-out reviewer must survive the move.** In the lane, review is a fresh session that cannot
>   see how the builder reasoned. Archon's house workflow must keep review as a separate session from
>   implement, with a test in Cowgate that fails if they are ever joined.
>
> The analysis below is unchanged and is kept as the reasoning. Only "Scope", "Out of scope" and
> "Acceptance criteria" at the foot were rewritten.

> **Second citation for take 1, added 2026-09-29.** Buzz (FB-220) independently reached the same idea
> as Cole Medin's fire budget: it makes **`NO_REPLY` a declared outcome** of a workflow step, so
> "nothing worth saying" is a real answer rather than the absence of one. Two systems arriving at the
> same answer from different directions is usually a sign the answer is right. The fire-budget ticket
> this one files should cite both.

## What we already took, and where from

Cole Medin runs a knowledge base of 198 videos, 243 concept pages and about 925,000 words of
transcript, written to be read by an agent
(`github.com/coleam00/cole-medin-knowledge-base`). Two of his rules are already load-bearing on this
machine, and neither started here:

- **sd3** (`CLAUDE.md`, non-negotiables): *"Deterministic data gathering separated from LLM reasoning
  (Cole Medin)."*
- **cyclops** (`CLAUDE.md` #4): *"Facts are gathered by code, judgement is made by Claude… (Cole Medin's
  rule, as in sd3.)"*

The Foundry Studio follows the same rule without crediting it. `lib/activity-kind.ts` reads the paths a
commit touched and never the title. `lib/ledger.ts` computes tone from numbers. The lane gathers with
bash and `gh`, then hands a model the result. That is his split, already in force.

sd3 also ran a full review of his catalogue on 2026-09-17
(`/home/dev/projects/sd3/docs/reports/SD3_Agent_Architecture_Research_Sep2026.md`, 233 lines, every
claim carrying its URL). **This ticket does not repeat that research.** It takes that document's
findings and asks one question: which of them are true of *this* repo, checked against this code.

## The one we already do, and should stop worrying about

**The hold-out critic.** His argument:

> *"The worst thing you can do is have a coding agent evaluate its own work… It's going to give itself a
> gold star every time because it's like a student grading their own homework."*

The fix is a second call that sees the draft and the facts but **not the reasoning that produced them**.

**We already do this, and it was not luck.** `deploy/lane/foundry-lib.sh` → `claude_lane()` invokes
`claude -p` with **no `--continue` and no `--resume`**, so each of the lane's five stages per round is a
fresh session. `/review` sees the branch diff; it cannot see how the implementer talked itself into the
change. `supervisor.sh:473` already reasons about this in a comment.

Verified 2026-09-25 by reading `claude_lane()` and every call site. Worth writing down, because the next
person optimising the lane will be tempted to reuse a session to save tokens, and that would quietly
turn our reviewer into a student marking their own homework.

## The four we have not taken

Ranked by what they fix here, not by how interesting they are.

### 1. Standing intents with a fire budget — the repeat is our oldest visible bug

His named fix for a system that *"said the same true thing twenty times."*

Ours said it twenty times on a screen a founder was looking at. From CLAUDE.md #11: *"'What happened'
was printing the same sentence twenty times."* It was fixed by changing that screen. **The rule that
allowed it was never written down**, so nothing stops the next surface doing the same thing.

What this asks for: an observation carries a fire budget — how many times it may be said, and after
what silence it may be said again — and the budget lives beside the observation, not inside the one
component that learned the lesson.

This is the highest-value item because the failure is documented, visible, and currently prevented only
by one screen's memory of being wrong.

### 2. Invert the negative instructions — and we have the count

His finding:

> *"LLMs, they love to drop the negative, as in they will kind of like take out the do not and then
> they'll do the very thing that you told them not to do."*

sd3 measured itself: 17 negative clauses in 18 lines. **Measured here on 2026-09-25:**

| file | negative clauses | size |
|---|---|---|
| `deploy/lane/supervisor.sh` (the lane's prompts) | **41** — 19 "do not", 18 "never", 2 "must not", 2 "don't" | — |
| `CLAUDE.md` | **22** — 15 "never", 6 "do not", 1 "forbids" | 189 lines |

The lane's 41 are the ones that matter, because they are instructions to a model on every run. One of
them is already known to be weak: `supervisor.sh:437` concedes that *"'Do NOT edit any files' is a soft
instruction to a session that holds Edit and Write."* We noticed the specific case and did not
generalise it.

**This does not mean rewriting CLAUDE.md.** CLAUDE.md is read by John as much as by a model, and its
"never" clauses carry the reason they exist, which is the point of them. The scope is the lane's
prompts, where the reader is only ever a model.

### 3. A composer with no tools — "drop the scaffolding"

> *"The defining trait is that it carries no tools… it never has to decide whether to search, so it
> cannot fan out further or hallucinate an action. Its system prompt is about format and voice: merge
> the recommendations, keep the tone consistent, and drop the scaffolding of who produced what."*

"Drop the scaffolding" is the repeated-name problem, and the studio has the same shape wherever it
renders several findings into one thing a founder reads. Our composer is `deploy/librechat` +
`components/Composer.tsx` with `claude-sonnet-5` seeded in `deploy/librechat/seed-agent.js`. Whether it
holds tools it does not need is a question this ticket asks; it is not yet an answer.

### 4. Fix the system, not the bug

> *"Don't just fix the bug. Fix the system that allowed the bug… Every mistake becomes an opportunity to
> improve your harness."*

**We do this better than the other three, and we should say so, because it is the one that improves
memory** — the thing John actually asked about.

The evidence: CLAUDE.md #11 and #12 both exist because a specific failure happened and the *rule* was
changed, not just the screen. The Playwright gate became required after a red one merged itself. The
memory directory holds fourteen notes that each name a system fault rather than an incident —
`a-test-that-cannot-fail`, `print-where-you-landed`, `degraded-only-exists-if-you-can-induce-it`.

What is missing is that this happens when John notices, not when the system does. His version is that
**every complaint becomes a rule**, automatically, because with one user there will never be
statistically meaningful data — the feedback loop has to be cheap enough to run on a sample size of one.

## What sd3 concluded that we should NOT copy

Two things, and getting these wrong would cost more than the four above are worth.

**His memory work is not new to us.** sd3's own verdict: *"Cole Medin's memory work — second brain,
heartbeat, self-evolving memory. **We already have all of it.** Nothing new there."* FB-050 built the
venture brain; FB-219 has just made gbrain answer questions about this code. There is no gap here to
fill, and the memory note `jstack-second-brain-requirement` (which says FB-028 must fold in his
second-brain methods) should be read in that light: the pattern is in, the branding is not needed.

**"Traditional RAG is dead" does not apply to us the way it applies to him.** His argument:

> *"The only reason traditional RAG is dead for AI coding is because of how structured our code bases
> are."*

sd3 accepted this and closed a scope item with *"do not build a vector store over the event graph"* —
correctly, for a finance corpus where exact matching wins (*"we search AAPL, we'll find the stock and
not the fruit"*).

**We must not read that as "gbrain was a mistake."** Two different uses:

- *Developer search* — a person or agent asking "where is this handled?" with no exact string yet. This
  is what FB-219 fixed and it demonstrably works: `code-def rowReason` → `lib/ledger.ts:110-135`.
- *Retrieval inside the agent loop* — `brain_research` in `deploy/lane/foundry-lib.sh`, which feeds
  gbrain results into the lane's RESEARCH step before it plans.

His argument bites on the second, not the first. Whether the lane should be doing structured lookup
(ticket id, department, status) instead of semantic search at that point is a real open question and
worth asking honestly. It is **not** in this ticket's scope, and this ticket should not pretend to
answer it.

## Scope

1. Write `docs/ideas-from-cole-medin.md` in the same three-part shape as `docs/ideas-from-meridian.md`:
   **already doing** (the gather/reason split, the hold-out reviewer, fix-the-system, and now Archon
   itself), **worth taking** (the fire budget), **explicitly not taking** (his memory stack, and
   "RAG is dead" as applied to developer search). Every claim carries where it came from. Credit sd3's
   2026-09-17 report rather than re-deriving it.
2. File **take 1, the fire budget,** as its own fountainbridge ticket: an observation carries how many
   times it may be said and after what silence it may be said again, kept beside the observation and
   not inside one screen. Cite Buzz's `NO_REPLY` (FB-220) as the second source.
3. Write the **two Cowgate items** into the ideas document, ready for John to file in Cowgate: the
   negative-instruction audit of `bruntsfield-ticket`'s prompts, and a test that review stays a
   separate session from implement.
4. Add the document to `README.md`'s read order.

## Out of scope

- Implementing any take.
- Filing tickets in Cowgate. That is Cowgate's repository; this ticket hands John the wording.
- Rewriting `CLAUDE.md`'s negative clauses. Its reader includes a person, and its "never" clauses
  carry their reasons.
- Whether the lane should use structured lookup instead of semantic search. If the lane retires, the
  question moves with it.

## Acceptance criteria

- [ ] `docs/ideas-from-cole-medin.md` exists and separates the three cases, and says that Archon is
      his project and how it changes them.
- [ ] It states that the gather/reason split arrived here through sd3 and cyclops, with the quotes
      from both `CLAUDE.md` files.
- [ ] It records the measured counts (41 negative clauses in `supervisor.sh`, 22 in `CLAUDE.md`,
      2026-09-25) and says they matter only while the lane exists.
- [ ] The fire-budget ticket exists, citing the repeated-sentence bug and Buzz's `NO_REPLY`.
- [ ] The two Cowgate items are written out for John.
- [ ] No behaviour change: the diff touches markdown only.

## Verification

No screen changes, so non-negotiable 11 does not apply — say that in the PR body rather than leaving it
blank.

Two claims here were checked against the code on 2026-09-25 rather than assumed, and anyone overturning
this should recheck them:

- **The lane's stages are separate sessions.** `claude_lane()` in `deploy/lane/foundry-lib.sh` runs
  `claude -p` with no `--continue`/`--resume`; confirmed at all five call sites in `supervisor.sh`.
- **The negative-clause counts** came from counting `never|do not|don't|must not|avoid|forbids` in each
  file. A crude measure — it will catch a "never" inside prose that is not an instruction — so treat the
  number as an order of magnitude, not a precise count.
