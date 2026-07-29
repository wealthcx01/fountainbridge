# Foundry venture lane runtime (FB-039)

The engine behind the composer, on the venture's **own** Hetzner box (D1). Design:
`docs/founder-to-lane-execution.md`. This is the runtime + the spike supervisor; the autonomous
scheduler (scan + budget + gate routing) is FB-040.

## What's here
- `supervisor.sh` — one lane pass: **claim** a ticket via branch-create CAS → run a **Claude Code
  lane** to implement it → open a **PR** (a human merges) → write a **RunReport** to the `foundry-state`
  ref. Holds no send/deploy power (§8).
- `foundry-lane.service` / `.timer` — systemd templates for the pull trigger. **Not auto-enabled** —
  FB-040 wires the autonomous scan + budget cap + gate.

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
