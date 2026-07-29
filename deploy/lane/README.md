# Foundry venture lane runtime (FB-039)

The engine behind the composer, on the venture's **own** Hetzner box (D1). Design:
`docs/founder-to-lane-execution.md`. This is the runtime + the spike supervisor; the autonomous
scheduler (scan + budget + gate routing) is FB-040.

## What's here
- `foundry-lib.sh` — shared helpers (`gh_api`, `jval`, `write_runreport`, `ensure_state_ref`).
- `supervisor.sh` — one lane pass: **claim** a ticket via branch-create CAS → flip its Status
  Todo→In progress → run a **Claude Code lane** to implement it → open a **PR** (a human merges) →
  write a **RunReport** to the `foundry-state` ref. Holds no send/deploy power (§8).
- `run-once.sh` (FB-040) — the **autonomous wake**: scan for a `Todo`/`Ready` ticket → "useful work?"
  (idle heartbeat if none) → stale-reclaim → circuit-breaker → budget gate → blast-radius routing
  (full-auto for low-risk; **stop-at-PLAN** for auth/payments/sends/migrations). Called by the timer.
- `foundry-lane.service` / `.timer` — the systemd pull trigger (~5-min oneshot).

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
