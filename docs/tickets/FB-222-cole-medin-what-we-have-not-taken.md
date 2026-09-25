# FB-222 — Cole Medin: the four things we have not taken, and the one we already do

**Status:** filed · **Phase:** 3 · **Raised by:** John, 2026-09-25 — *"look at Cole Medin and how we
have used him in other projects on this VM… That should help improve our memory and how we develop when
we implement his principals."* · **Branch:** `fb-222-cole-medin-principles` ·
One ticket = one branch = one PR.

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
   **already doing** (gather/reason split, hold-out critic, fix-the-system), **worth taking** (the four
   above), **explicitly not taking** (his memory stack, and RAG-is-dead as applied to developer search).
   Every claim carries where it came from. Credit sd3's 2026-09-17 report rather than re-deriving it.
2. Record the hold-out-critic property as a rule: the lane's stages must stay separate `claude -p`
   invocations, and reusing a session to save tokens breaks the reviewer. This belongs next to
   `claude_lane()` as a comment, and in the document.
3. File the four takes as their own tickets, each on its own merits, smallest first. Do not implement
   any of them here.
4. Add the document to `README.md`'s read order.

## Out of scope

- Implementing any of the four. This ticket produces a document and four ticket files, no behaviour
  change.
- Rewriting CLAUDE.md's negative clauses. Its audience includes a person, and its "never" clauses carry
  their reasons. Only the lane's prompts are candidates, and that is take 2's own ticket.
- Whether the lane should use structured lookup instead of semantic search in RESEARCH. Named above as
  an open question, deliberately unanswered.
- FB-028 and the `jstack-second-brain-requirement` note. Related, older, separate.
- Anything requiring a new dependency or an external call.

## Acceptance criteria

- [ ] `docs/ideas-from-cole-medin.md` exists and separates the three cases, so a reader can tell what
      changes from what does not.
- [ ] It states that the gather/reason split arrived here through sd3 and cyclops, with the quotes from
      both `CLAUDE.md` files, so the lineage is not lost.
- [ ] It records the two measured numbers (41 negative clauses in `supervisor.sh`, 22 in `CLAUDE.md`)
      with the date they were measured, because both will drift.
- [ ] It names the repeated-sentence bug as the concrete case for a fire budget, and says plainly that
      the rule which allowed it was never written down.
- [ ] It credits sd3's report by path rather than restating its research.
- [ ] Four ticket files exist, one per take, each independently shippable.
- [ ] The hold-out-critic property is recorded as a comment beside `claude_lane()`.
- [ ] No behaviour change: `git diff --stat` touches markdown plus one shell comment.

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
