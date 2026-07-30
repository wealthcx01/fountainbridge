# FB-041 — gstack RPIV loop in the lane (fully apply gstack + Cole Medin's RPIV)

**Status:** Done · **Phase:** 2 · **Depends on:** FB-039/040 (lane runtime + autonomous wake),
FB-050 (gbrain) · **Repo:** fountainbridge (+ venture VM) · **Branch:** `fb-041-gstack-rpiv-lane-loop`
One ticket = one branch = one PR.

**Design:** `docs/lane-rpiv-loop.md` (adversarially reviewed). Gate decision (John, 2026-07-29): the
*safe* full gate — tests + /review hard-gate every ticket; browser /qa runs always but under a memory
cgroup cap + RAM pre-check, and DEFERS (non-blocking) when it can't test, so it never bricks a
backend/docs ticket nor OOM-kills the founder's live composer. RESEARCH reads context/ raw (gbrain =
FB-050), PLAN is PRP-lite (full PRP = FB-052).

## Why this matters (for the founder)
This is what makes the agent's work *good*, not just done: it plans before it builds, and reviews +
tests its own work before it ever reaches you. The difference between "a bot changed a file" and "a
disciplined engineer shipped it."

## Context
Today the lane is a raw `claude -p` that implements a ticket directly (FB-040) — the thin version. The
Bruntsfield Loop (`docs/jstack-bruntsfield-method.md`, `docs/founder-to-lane-execution.md` §5) calls
for the FULL gstack/RPIV loop. This ticket applies gstack **fully**: the unchanged engine, run per the
method — no fork (method doc §2).

## Scope (fully applies gstack + RPIV)
- **Install gstack on the venture box** (skills suite; the same tooling the studio-build lanes use),
  pinned + upgradeable on the normal cadence.
- **The lane runs the real loop**, not a bare prompt: **RESEARCH** (gbrain, FB-050) → **PLAN** (`/plan`,
  or `/plan-ceo-review` for large/ambiguous asks) producing a PRP (FB-052) → **IMPLEMENT** one
  ticket = one branch = one PR → **VALIDATE**: `/review` (staff-engineer audit incl. adversarial) +
  `/qa` **before the PR opens** (non-negotiable 9) — no `--no-verify`.
- **Department routing**: the lane picks a ticket's `department` (build/sell/scale) and works it in the
  right repo/queue (with FB-045).
- **Fail-loud**: `/review` or `/qa` findings the lane can't resolve → a `blocked` RunReport with the
  reason, not a quietly-shipped PR.

## Out of scope
- The gbrain install itself (FB-050) and the PRP-quality layer (FB-052) — depended on here.
- External-action execution (that stays behind the FB-044/046 gate).

## Acceptance criteria
- [x] gstack installed on the box (pinned `7c9df1c5`, incl. Playwright/Chromium); the lane invokes
  PLAN (PRP-lite) + `/review` + `/qa` — verifiable in the run log/RunReport.
- [x] A lane PR is only opened after tests + `/review` pass (and `/qa` doesn't find bugs); a failing gate
  → a `blocked` RunReport, no PR (structural, supervisor-owned).
- [x] The lane routes a ticket to its department's repo/queue (`build`; Sell/Scale → parked until FB-045).

## Verification — DONE (2026-07-30, live on ARCA's box 167.233.160.141)
`make provision-lint` (shellcheck) + a full end-to-end run: a Todo ticket went
CLAIM→ROUTE(build)→baseline-probe→PLAN(26 lines)→IMPLEMENT→COMMIT→VALIDATE and opened
`wealthcx01/arca#10` with the gate evidence in the PR body + RunReport:
`tests ✅ · /review ✅ (0 critical) · /qa: no web-facing surface to test`. Baseline-diff gating let the
change through despite arca's red `typecheck`/`lint` baseline (no regression); `/qa` correctly deferred
on the docs-only change in 18s without launching Chromium. Smoke PR/branch/RunReports cleaned up; the
autonomous timer is re-enabled.

### Runtime gotchas found + fixed (carry to every venture box)
- **Root can't `bypassPermissions`.** `--dangerously-skip-permissions` is refused under root (the lane's
  systemd identity), so `/review`/`/qa` silently no-op. Fix: `acceptEdits` + an explicit `--allowedTools`
  allowlist. Safe because the box holds no send/deploy creds (§8).
- **Install order:** `./setup` launches Chromium to verify it (`ensure_playwright_browser`) and `exit 1`s
  *before* wiring the skills if it can't — so `playwright install --with-deps chromium` must run BEFORE
  `./setup`, else `/review`+`/qa-only` never get wired.
- **Headless `/review` doesn't run its own `gstack-review-log`,** so the gate reads an explicit
  `review.json` verdict the phase writes (layered on the unfakeable regression floor), not the artifact.
