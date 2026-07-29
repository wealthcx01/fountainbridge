# FB-039 — Venture lane runtime + the founder→lane spike

**Status:** In review · **Phase:** 2 · **Depends on:** FB-037 (design) · **Repo:** fountainbridge
(+ ARCA Hetzner VM) · **Branch:** `fb-039-venture-lane-runtime` · One ticket = one branch = one PR.

## Why this matters (for the founder)
This is the moment the studio stops being a front door and starts being a factory: the venture's box
can now **pick up a ticket and do the work** — a real change, opened as a PR for your OK. Proven end
to end.

## Context
Per `docs/founder-to-lane-execution.md` (the FB-037 design, CEO+eng reviewed), the founder→lane loop
needs a **runtime on the venture box** — the box ran only LibreChat. This ticket stands up that
runtime and ships a **thin spike** proving the core loop: claim → work → PR → RunReport, gated.

## Scope
- **Lane runtime on ARCA's box:** Node 20 + Claude Code installed; the venture repo cloned to
  `/opt/foundry/lane/arca`; Claude runs headless (`claude -p`). Auth: `ANTHROPIC_API_KEY` for the
  spike; **production preference is shared Claude Max via a `claude setup-token`** (John, pref 1 —
  per-venture key is the option when budget enforcement matters). **No send/deploy creds on the box**
  (§8 — the lane can never send or deploy).
- **The supervisor** (`deploy/lane/supervisor.sh`): the spike loop — **claim via branch-create CAS**
  (the atomic lock, §4), run the Claude Code lane to implement one ticket on the branch, open a PR (a
  human still merges — #2), and write **RunReports** (`working` → `opened_pr`/`failed`) to the
  direct-push `foundry-state` ref (§6) the studio can read.
- **systemd templates** (`foundry-lane.service` oneshot + `.timer`) — the pull trigger, **not
  auto-enabled** (the autonomous ticket-scan + budget cap + gate routing is FB-040).

## Out of scope
- The autonomous ticket-scan + "useful work?" pre-check + budget/circuit-breaker + gate routing
  (FB-040). The second-brain bridge (FB-043). The gated executor + ActiveGraph (FB-044).

## Acceptance criteria
- [x] Node + Claude Code installed on the box; venture repo cloned; `claude -p` runs headless.
- [x] The supervisor claims a ticket via branch-create CAS and **yields** if already claimed (no
      double-work — verified).
- [x] The lane implements a trivial ticket, opens a **real PR** (wealthcx01/arca#5, closed after), and
      writes `working` + `opened_pr` RunReports to `foundry-state`.
- [x] No external send/deploy occurs; the PR is opened for a human to merge.

## Verification
`/review` + CI on the repo. Live proof on ARCA's box: the supervisor ran the spike ticket end to end
(claim → Claude Code lane → PR #5 → RunReports), the CAS yielded on re-run, PR content was exactly the
ticket's ask. Smoke PR + branch cleaned up; `foundry-state` retains the RunReports as the audit trail.
