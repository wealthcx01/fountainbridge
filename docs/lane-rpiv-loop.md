# The lane RPIV loop (FB-041) — making the lane brain real

**Status:** design for FB-041 · supersedes the thin `claude -p` lane (FB-040) · see
`docs/founder-to-lane-execution.md` §5 and `docs/jstack-bruntsfield-method.md`.

## The problem this solves (for the founder)

Today the lane is one raw `claude -p` that edits files and opens a PR (`supervisor.sh` before this
ticket). It *does* the work; it does not *plan* the work, and it never reviews or tests itself before
the founder sees it. FB-041 turns "a bot changed a file" into "a disciplined engineer shipped it":
the lane plans, implements, then **reviews and QA-tests its own work — and only opens a PR if that
passes**. A failing check never becomes a silent PR; it becomes a plain-language `blocked` RunReport
the founder can see (non-negotiable 10).

## Decision (John, 2026-07-29): the *safe* full gate, always

Every worked ticket runs **the venture's own tests + `/review` + browser `/qa`** before any PR opens.
The venture box carries the full gstack install **including the Playwright/Chromium browser stack** so
`/qa` can drive the running app. Two guardrails (from the adversarial review) make "run browser `/qa`
on the same 2 GB box as the founder's live composer" safe rather than an outage:

- **The lane runs in a memory-capped cgroup** (`MemoryMax=` on `foundry-lane.service`, set *below*
  LibreChat's headroom) + a pre-flight RAM check. If `/qa`'s Chromium blows the budget, the kernel
  OOM-kills *the lane's* process tree — never `librechat-api`/`mongodb`. The founder's chat stays up.
- **`/qa` fails on real bugs, but *defers* (non-blocking) when it genuinely can't test** — a change
  with no web surface, an app that won't boot headless, or low free memory. It never false-fails a
  backend/docs ticket into a permanent block (which would ship nothing — the lane's whole point).
  `tests + /review` remain the hard floor on every ticket regardless. *(Since FB-052 a bug `/qa`
  reproduces sends the ticket back round the validation loop rather than parking it outright, and
  `/qa` runs only on a round that has already passed the other checks — so it still runs on every
  ticket that reaches it, at most once per round.)*

## The loop (RPIV = Research → Plan → Implement → Validate)

The **supervisor orchestrates** the phases deterministically (bash control flow); each phase is a
discrete, timeout-wrapped headless `claude -p` invocation or a shell gate. The supervisor — never the
model — decides whether a PR opens. This is the codebase's determinism ethos (deterministic
orchestration, model does the steps) and it makes the acceptance criterion *structural*: "PR only
after review + qa pass" is enforced by control flow, not by trusting the agent.

```
CLAIM (branch-create CAS, unchanged)
  └─ ROUTE          department → repo/queue (manifest departments[]); unprovisioned repo → blocked
  └─ RESEARCH       gbrain query over the venture brain, partitioned to this department (FB-050);
                    falls back to reading context/ raw, and says so, if the brain is unavailable
  └─ PLAN           claude -p: write a PRP → $RUNDIR/prp.md (FB-052). Not just a plan: intent,
                    context, tasks, and explicit VALIDATION GATES saying how "done" gets proved.
                    The supervisor enforces the shape — no gates ⇒ not a PRP ⇒ does not proceed.
                    Persisted to $STATE_REF:prps/<slug>.md, so a later run RESUMES instead of
                    re-planning ("clear the chat, resume from the board").
  ┌─ (loop, up to MAX_VALIDATION_ROUNDS — default 2, i.e. one repair) ─────────────────────────┐
  │ IMPLEMENT       claude -p: implement per the PRP, smallest correct change. On a repair round,
  │                 the prompt carries exactly what failed and forbids weakening a test or a gate.
  │ COMMIT          commit to the claim branch (local only — not pushed). Validation runs against
  │                 this exact SHA, so the eventual PR is byte-for-byte what review saw. Repair
  │                 rounds --amend, so the PR stays one commit; a repair that changed nothing blocks
  │                 rather than re-running identical checks.
  │ VALIDATE        the four checks below. Any failure that a further round could plausibly fix
  │                 loops BACK to IMPLEMENT rather than forward to the founder. A phase that stopped
  │                 to ask a human, or timed out, parks immediately — another round can't help.
  └────────────────────────────────────────────────────────────────────────────────────────────┘
  └─ VALIDATE (the hard floor must pass — exhausting the rounds ⇒ `blocked` RunReport, no push, no PR):
       tests        [HARD] run the venture toolchain (bun/npm typecheck+lint+test) and gate on the
                    REGRESSION vs a baseline probe taken before the lane touched anything — so the lane
                    is blocked only by breakage IT caused, never by the venture's pre-existing debt
                    (arca's typecheck/lint are already red on master). Exit codes; unfakeable.
       PRP gates    [HARD] claude -p: check the finished code against the PRP's OWN gates, one
                    verdict per gate as JSON. A gate nobody reports on counts as NOT passed — silence
                    is not evidence (prp-lib.mjs `applyVerdicts`). The ✅/❌ list goes in the PR body,
                    so the human gate sees the lane's stated criteria and whether each one held.
       /review      [HARD] claude -p /review → the explicit verdict it writes to
                    $RUNDIR/review-<round>.json: fail if verdict≠pass OR critical>0 OR it edited files
                    (it wanted to change the code → not clean). A missing verdict fails closed.
                    (Headless /review does not reliably run gstack's own review-log step, which is why
                    the binding is an explicit verdict file rather than that artifact.)
       /qa          claude -p /qa-only (report-only, never edits) → $RUNDIR/qa-<round>.json. Runs only
                    on an otherwise-clean round, so it costs at most one run per round. A bug it
                    reproduces LOOPS like any other failed gate; it still DEFERS (non-blocking) when
                    it cannot test at all — can't-boot / no-web-surface / low-RAM.
  └─ GATE           floor passes → push the branch + open PR (a human still merges — non-negotiable 2)
                    any fail → `blocked` RunReport with the reason; branch never pushed, so the
                    autonomous scan reclaims + retries, bounded by the circuit-breaker (FB-040), and a
                    terminal `blocked` report fires at MAX_ATTEMPTS (no silent abandonment)
```

### Why the report-only QA variant + objective review binding

`/qa` (the full skill) *fixes* bugs and auto-commits them — that would let QA mutate code that never
went through `/review` and take commit authority from the supervisor. So the gate runs **`/qa-only`**
(report-only: tests, screenshots, health score, never edits) and the *supervisor* acts on the report.

The gate is bound to **objective signals, not the model's self-assessment** (the adversarial review's
P0-3): the hard floor is `tests/typecheck/lint` **exit codes**, which cannot be faked, plus gstack's
own structured review log (`gstack-review-log` writes `{status, critical, quality_score, findings}`
per branch — the same artifact the studio-build lanes trust). If `/review` *edited files*, that is
itself evidence it found problems → block. `/qa` has no structured artifact, so it stays a best-effort
report: it blocks only on reported bugs and defers when it can't test. A **missing/unparseable verdict
is fail-closed** — the run scratch (plan, verdicts, logs) lives in `$RUNDIR` **outside the worktree**
(`/opt/foundry/lane/state/runs/<slug>-<ts>/`), so `git add` never sweeps it into the venture repo.

### Headless BLOCKED is a first-class outcome

gstack skills detect headless sessions and, at any point that would need a human decision, emit
`BLOCKED — AskUserQuestion unavailable` and end the turn (they do **not** hang). The supervisor treats
a phase that ends BLOCKED (or times out) as a `blocked` RunReport with the reason surfaced — the same
fail-loud path as a failed check. This is aligned with the design's stop-at-plan philosophy: when the
agent genuinely needs a human call, it stops and says so rather than guessing.

### Timeouts

Every `claude -p` phase is wrapped in `timeout`. `/qa` starts the app and drives Chromium, so it gets
the longest budget. A timeout ⇒ `blocked` (never a silent hang, never a partial PR).

## The PRP and its validation loop (FB-052)

**What a PRP is.** A Product Requirement Prompt (Cole Medin / Rasmus — `docs/jstack-bruntsfield-method.md`
§3) is a plan that also writes down, before any code exists, how the work will be *proved*. Five
sections, all required: Intent, Context, Approach, Tasks, **Validation gates**. The gates are
checklist items covering four dimensions — happy path, edge cases, errors, coverage.

**Why the supervisor enforces the shape.** A plan with no gates would sail through the rest of the
loop and the founder would be told the lane validated against criteria that never existed. So
`prp_ok` gates it: no gates ⇒ not a PRP ⇒ the lane re-plans once with the specific problem quoted
back, then blocks. "The lane decided its own acceptance criteria up front" is structural.

**Why silence counts as failure.** `applyVerdicts` marks any gate the checking step didn't report on
as *not passed*. The alternative — treating an unmentioned gate as fine — is how a validation loop
becomes decorative: the cheapest way to pass is to say nothing.

**Why failure loops back rather than forward.** RPIV's V is a loop, not a checkpoint. A test the lane
broke, a gate that doesn't hold, a `/review` that won't clear it — those are defects the lane can
plausibly fix from the failure text, so it gets a bounded number of goes before a human is asked to
look. Bounded because each round is ~3 more model sessions against a shared Claude Max and the wake
budget counts a ticket once: `MAX_VALIDATION_ROUNDS` defaults to 2 (one repair).

Two things deliberately do NOT loop: a phase that stopped to ask a human (`phase_blocked`) and a
timeout. Another identical round cannot resolve either, and retrying would just burn budget.

**Resume from the board.** The PRP is written to the engine-state ref (`prps/<slug>.md`) *before*
IMPLEMENT runs. A lane that picks the ticket up again — after a reclaim, a restart, a fresh session
with no history — reads it back and continues instead of re-planning. That is Archon's "clear the
chat, resume from the board" made concrete: the durable context is the ticket plus the PRP, never a
session's chat history. Round-tripped in `__tests__/prp-resume.test.mjs`, GitHub's wrapped base64
and UTF-8 included.

**What the founder sees.** The PR body carries the gates and whether each held:

```
## How the lane said it would check this
- ✅ happy path: the card page shows a 12-month chart for a card with sales
- ✅ edge cases: a card with no sales renders an empty state, not a crash
- ❌ errors: …
```

That is the point of the whole ticket: the human gate reads the lane's *own* stated criteria and the
evidence, not a generic "tests passed".

## Department routing (FB-041 slice; FB-045 provisions Sell/Scale)

The ticket's department (a `**Department:**` field, default `build`) maps to the manifest's
`departments[]` → repo + queue_path + gate. If that department's repo isn't provisioned (Sell/Scale
today), the lane records a `blocked` RunReport ("this belongs to Sell, whose repo isn't set up yet")
rather than working it in the wrong repo. FB-045 provisions `arca-marketing` / `arca-ops` and turns
routing on for all three surfaces.

## Box install (the full gstack + browser stack)

`deploy/lane/install-gstack.sh` (idempotent, run once per venture box):
1. Ensure `bun` (gstack's runtime) — install if absent (`unzip` prerequisite is present on the box).
2. Clone gstack **pinned to a recorded commit** (not floating `main`): `GSTACK_PIN=7c9df1c5…`, the exact
   rev the studio-build lanes run. A third-party repo executed as root with a repo-write token must be
   reproducible + pinned (adversarial review P1); upgrades are deliberate, never an implicit ff-of-main.
3. `./setup` — wires the skills into `~/.claude/skills/`; `bun install --frozen-lockfile` (repo ships `bun.lock`).
4. `bunx playwright install --with-deps chromium` — the browser `/qa` needs.
5. Seed `~/.gstack/config.yaml` (`proactive: false`, `auto_upgrade: false`) so headless lanes never
   prompt or self-upgrade mid-run.
6. Verify: `gstack-session-kind` + a headless skill smoke returns without a permission prompt.

Footprint: ~1.7 GB on 14 GB free disk (fine).

### Safety on a shared 2 GB box (adversarial review P0-2)

- **`foundry-lane.service` gets `MemoryMax=1536M` + `MemoryHigh=1280M`.** The lane's whole process tree
  (`claude -p` → node → Chromium) lives in that cgroup, so an OOM is scoped to the lane and the kernel
  kills the lane's Chromium — never LibreChat. Tune if `/qa` OOMs too eagerly.
- **Pre-flight RAM check** in `run-once.sh`: below a floor of free memory, `/qa` is skipped with a
  `deferred: low memory` note (tests + `/review` still gate).
- **Permission mode:** validate phases must boot a dev server + drive a browser, so they run
  `--permission-mode bypassPermissions`. Safe because the box holds **no send/deploy/payment creds**
  (non-negotiable 8) — blast radius is the repo working tree, which the gate controls.
- **Phase-session budget:** each wake now runs up to ~4 agentic sessions (plan/implement/review/qa), not
  one, so `DAILY_WAKE_BUDGET` defaults **lower (8)** to stay within shared Claude Max limits.

## Out of scope (depended-on, not built here)

- gbrain semantic RESEARCH — **delivered by FB-050** (`docs/venture-brain.md`). The raw `context/`
  read described here is now the documented fallback for when the brain is unavailable.
- Full PRP (context + validation gates in the plan) — **delivered by FB-052**; see the PRP section
  above. PLAN was PRP-lite in FB-041.
- Executing external actions — stays behind the **FB-044/046** gate; the lane still holds no send/deploy creds.

## Acceptance (from the ticket)

- gstack installed on the box; the lane invokes `/plan`(PRP-lite) + `/review` + `/qa` — verifiable in
  the RunReport / run log.
- A PR opens **only** after review + qa pass; a failing gate ⇒ a `blocked` RunReport, no PR.
- The lane routes a ticket to its department's repo/queue.
</content>
</invoke>
