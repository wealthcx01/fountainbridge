# FB-040 — Autonomous lane: scan + budget + circuit-breaker + gate routing

**Status:** In review · **Phase:** 2 · **Depends on:** FB-039 (lane runtime + supervisor) · **Repo:**
fountainbridge (+ ARCA Hetzner VM) · **Branch:** `fb-040-autonomous-lane` · One ticket = one branch =
one PR.

## Why this matters (for the founder)
The lane now works your backlog **on its own**. File a piece of work; the venture's box picks it up
within minutes, does it, and opens it for your OK — no one has to press go. High-impact things
(anything touching logins, payments, or sending) pause for your say-so first, and it can't run away
with your budget.

## Context
FB-039 proved the loop when invoked by hand. FB-040 makes it **autonomous** per the design
(`docs/founder-to-lane-execution.md` §4/§8/§10b): a systemd timer wakes the lane, which scans for a
workable ticket, checks it's worth a session, routes by blast-radius, and runs — or stops for the
founder. Safe by construction: only `Todo`/`Ready` tickets are auto-worked (a real backlog of
Planned/Shipped tickets is untouched), sensitive work never auto-opens a PR, and the box holds no
send/deploy creds (§8).

## Scope
- **`deploy/lane/run-once.sh`** — the autonomous wake: refresh master → **scan** for a `Todo`/`Ready`
  ticket → **"useful work?"** (idle heartbeat if none, no model session) → **stale-claim reclaim** →
  **circuit-breaker** (max attempts/ticket) → **budget gate** (per-day wake cap) → **blast-radius
  routing**: full-auto for low-risk; **stop-at-PLAN** (`awaiting_founder`, no PR) for
  auth/payments/sends/migrations/secrets.
- **`deploy/lane/foundry-lib.sh`** — shared helpers (`gh_api`, `jval`, `write_runreport`,
  `ensure_state_ref`) sourced by the supervisor + wrapper; the idle heartbeat overwrites one
  `_heartbeat.json` (a liveness beacon, no flood).
- **supervisor.sh** — flips the worked ticket's Status `Todo → In progress` on the branch, so a merged
  PR leaves it non-workable (no re-pick).
- **systemd** — the `.timer` (oneshot service, ~5-min cadence) installed + **enabled** on ARCA's box.

## Out of scope
- The second-brain bridge (FB-043); the gated executor + full ActiveGraph (FB-044); per-department
  routing tuning (FB-041/FB-045). Budget is a local wake cap (shared Max has no per-venture spend cap,
  §10b); a metered cap needs the per-venture key.

## Acceptance criteria
- [x] Idle wake (no `Todo`) → single heartbeat RunReport, no model session.
- [x] A `Todo` ticket on master → autonomously claimed → worked → PR opened → RunReports.
- [x] Re-run with an open PR → skips (no double-work); the ticket flips to In progress on the branch.
- [x] A sensitive `Todo` (auth/payments/…) → `awaiting_founder`, **no auto-PR**.
- [x] The systemd timer is active on the box and fires the service (status=0/SUCCESS).

## Verification
`/review` + CI (shellcheck-clean). All five behaviours verified live on ARCA's box (Todo pick→PR,
idle heartbeat, in-flight skip, sensitive stop-at-plan, timer active); test tickets/PRs + state
cleaned up.
