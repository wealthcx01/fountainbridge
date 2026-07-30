# Foundry venture lane runtime (FB-039 → FB-041)

The engine behind the composer, on the venture's **own** Hetzner box (D1). Design:
`docs/founder-to-lane-execution.md` + `docs/lane-rpiv-loop.md` (the RPIV loop, FB-041).

Since FB-041 the lane no longer just edits a file — it runs the disciplined **RPIV loop** and reviews +
tests its own work before the founder ever sees a PR:
**RESEARCH** (the venture brain, FB-050) → **PLAN** (/plan → PRP-lite) → **IMPLEMENT** → **COMMIT** (local) →
**VALIDATE** (tests + /review [HARD] + browser /qa [SOFT]) → **GATE**: pass ⇒ push + PR; any fail ⇒ a
plain-language `blocked` RunReport, no PR. The supervisor (bash) owns the gate and binds it to
*objective* signals — test/typecheck/lint exit codes + gstack's own review artifact — not a self-graded
boolean.

## What's here
- `install-gstack.sh` (FB-041) — **run once per box**: installs gstack (pinned commit) + the
  Playwright/Chromium stack so the lane can run `/plan`, `/review`, `/qa`.
- `install-gbrain.sh` (FB-050) — **run once per box**: installs gbrain + local embeddings, indexes
  the venture repo, and enables the brain bridge + refresh timer. See `docs/venture-brain.md`.
- `brain-lib.mjs` / `brain-query.mjs` / `brain-bridge.mjs` / `gbrain-refresh.sh` (FB-050) — the
  venture brain: department partitioning + digest (pure, unit-tested), the query CLI the lane's
  RESEARCH step uses, the composer's read-only bridge, and the incremental re-index.
- `foundry-lib.sh` — shared helpers (`gh_api`, `jval`, `write_runreport`) + the RPIV primitives
  (`claude_lane`, `venture_gate`, `review_status`, `ticket_department`, `mem_available_mb`,
  `brain_research`).
- `supervisor.sh` — one lane pass: **claim** (branch-create CAS) → **route** (department) →
  RESEARCH→PLAN→IMPLEMENT→COMMIT→VALIDATE→**GATE** → PR (a human merges) → **RunReport**. No send/deploy
  power (§8).
- `run-once.sh` — the **autonomous wake**: scan for a `Todo`/`Ready` ticket → "useful work?" (idle
  heartbeat if none) → stale-reclaim → circuit-breaker (terminal `blocked` report at MAX_ATTEMPTS) →
  budget gate → blast-radius routing (full-auto RPIV for low-risk; **stop-at-PLAN**, plan attached, for
  auth/payments/sends/migrations). Called by the timer.
- `foundry-lane.service` / `.timer` — the systemd pull trigger (~5-min oneshot). The service sets a
  **memory cgroup cap** (`MemoryMax`) so `/qa`'s Chromium can never OOM-kill the founder's live composer.

## Enable the autonomous lane (FB-040)
```bash
cp foundry-lane.service foundry-lane.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now foundry-lane.timer
systemctl list-timers foundry-lane.timer     # active; fires every ~5 min
```
Only `Todo`/`Ready` tickets are auto-worked — a real backlog of Planned/Shipped tickets is untouched.
Tunables in `lane.env`: `DAILY_WAKE_BUDGET` (wake cap; the Max path has no per-venture spend cap),
`MAX_ATTEMPTS` (per-ticket circuit breaker).

## Bring-up (on the box)
```bash
# install runtime (once):
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs
npm install -g @anthropic-ai/claude-code
git clone https://x-access-token:<LANE_TOKEN>@github.com/<owner>/<repo>.git /opt/foundry/lane/<repo>

# install gstack so the lane runs the real RPIV loop (once, ~1.7 GB incl. the browser stack):
/opt/foundry/lane/install-gstack.sh

# install the venture brain so RESEARCH is semantic and the composer can search it (once, FB-050):
/opt/foundry/lane/install-gbrain.sh

# lane env (NO send/deploy creds here — §8):
cat > /opt/foundry/lane/lane.env <<'ENV'
REPO=wealthcx01/arca
REPO_DIR=/opt/foundry/lane/arca
TICKET_GITHUB_TOKEN=<repo-write deploy token — the lane identity>
ANTHROPIC_API_KEY=<spike auth>   # production: CLAUDE_CODE_OAUTH_TOKEN from `claude setup-token` (shared Max)
ENV

# run one pass on a ticket (spike):
set -a; . /opt/foundry/lane/lane.env; set +a
/opt/foundry/lane/supervisor.sh <slug> <ticket-file>
```

## Auth
Spike uses `ANTHROPIC_API_KEY`. **Production preference is shared Claude Max** (John, pref 1): run
`claude setup-token` on an authenticated machine, set `CLAUDE_CODE_OAUTH_TOKEN` in `lane.env`, drop the
API key. A per-venture Anthropic key is the option when a programmatic per-venture budget cap is needed
(the shared-Max path has no per-venture spend cap — see the design §10b).

## Verified (2026-07-29)
The supervisor ran a spike ticket end to end on ARCA's box: claim (branch CAS) → Claude Code lane →
PR (wealthcx01/arca#5) → `working`+`opened_pr` RunReports on `foundry-state`; the CAS yielded on
re-run. Nothing external sent.
