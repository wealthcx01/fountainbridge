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
- **`/qa` blocks on real bugs, but *defers* (non-blocking) when it genuinely can't test** — a change
  with no web surface, an app that won't boot headless, or low free memory. It always runs; it never
  false-fails a backend/docs ticket into a permanent block (which would ship nothing — the lane's whole
  point). `tests + /review` remain the hard floor on every ticket regardless.

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
  └─ PLAN           claude -p: plan the change → $RUNDIR/plan.md (PRP-lite; full PRP is FB-052)
  └─ IMPLEMENT      claude -p: implement per the plan, smallest correct change
  └─ COMMIT         commit the diff to the claim branch (local only — not pushed yet). Validation now
                    runs against this exact SHA, so the eventual PR is byte-for-byte what review saw.
  └─ VALIDATE (the hard floor must pass — any fail ⇒ `blocked` RunReport, no push, no PR):
       tests        [HARD] run the venture toolchain (bun/npm typecheck+lint+test) and gate on the
                    REGRESSION vs a baseline probe taken before the lane touched anything — so the lane
                    is blocked only by breakage IT caused, never by the venture's pre-existing debt
                    (arca's typecheck/lint are already red on master). Exit codes; unfakeable.
       /review      [HARD] claude -p /review → read gstack's own review artifact
                    (~/.gstack/projects/$SLUG/$BRANCH-reviews.jsonl): block if latest status is not a
                    ship OR critical>0 OR /review edited files (it wanted to change the code → not clean)
       /qa          [SOFT] claude -p /qa-only (report-only, never edits) → $RUNDIR/qa.json
                    block on reported bugs; DEFER (non-blocking) on can't-boot / no-web-surface / low-RAM
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
- Full PRP (context + validation gates in the plan) — **FB-052**. PLAN is PRP-lite here.
- Executing external actions — stays behind the **FB-044/046** gate; the lane still holds no send/deploy creds.

## Acceptance (from the ticket)

- gstack installed on the box; the lane invokes `/plan`(PRP-lite) + `/review` + `/qa` — verifiable in
  the RunReport / run log.
- A PR opens **only** after review + qa pass; a failing gate ⇒ a `blocked` RunReport, no PR.
- The lane routes a ticket to its department's repo/queue.
</content>
</invoke>
