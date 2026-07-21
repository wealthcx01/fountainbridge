# GRS-0034 — Launch readiness

- **Loop:** 6 (closes the build)
- **Branch:** `grs-0034-launch-readiness`
- **Status:** In review — launch ARTIFACTS delivered; production cutover flagged for the operator (see `docs/ops/launch-cutover.md`).
- **Normative source:** PRD §1 (portals/domains), §9; CLAUDE.md.
- **Depends on:** GRS-0032, GRS-0033.

## Goal

First real advisors onboarded on production.

## Delivered (artifacts) vs operator cutover

The exit criteria are all production-cutover actions — a real advisor on prod, restore/rollback
drills, a prod smoke run — which are outward-facing and credentialed and were **not** run
autonomously. What ships in the repo is everything needed to make that cutover a checklist, not a
build:

- **Production smoke suite** (scope 5): `scripts/prod_smoke.py` — health + authenticated reads plus a
  solo `--write` path (create → assess → live-score → archive the prospect), runnable against a live
  URL. Finalise → deliverable is governance-gated and CI-only. `tests/test_prod_smoke.py`
  runs the same step logic in-process in CI (so it can't rot) **and** drives the full synthetic
  engagement end-to-end there — created → assessed → dual-rated → committee-signed → finalised →
  deliverable generated + downloaded (the governance-gated part a single prod account can't do).
- **Invitation flow over HTTP** (scope 3): `tests/test_invitation_flow_http.py` — invite → accept →
  login → me → first owner-scoped read, exactly as the cohort onboards. Closes the gap that
  `/auth/accept-invitation` had no HTTP test.
- **Operations runbook** (scope 6): `docs/ops/RUNBOOK.md` — deploy, rollback, backup/restore,
  incident basics, support path, env vars + the production fail-loud guards.
- **Phase-2 seams** (scope 7): `docs/phase-2-seams.md` — what Holy Corner consumes from
  `bcap-contracts`, what Viewforth reads, and where code changes at integration time.
- **Launch cutover checklist**: `docs/ops/launch-cutover.md` — every remaining step tagged
  **[built]** (verify) or **[operator]** (needs credentials / a real user — do by hand).

Knowledge-base seed content (scope 4) is a content task on the existing rubric/guidance library
(`todo` anchors render "guidance not yet authored", never a silent blank) — tracked in the cutover
checklist, not code.

## Scope

1. Production Railway environment: separate service + Postgres from staging; secrets rotated; backups verified with an actual restore drill.
2. Domain wiring: advisors.bruntsfieldcapital.com; TLS; main-site login routing.
3. First advisor cohort invited (invitation-only flow exercised for real).
4. Knowledge-base seed content loaded (playbook, primers, initial vignettes).
5. E2E smoke suite runnable against production: read-only paths + one synthetic engagement end-to-end (created, assessed, finalised, deliverable generated, then archived).
6. Operations runbook: deploy, rollback, backup/restore, incident basics, support contact path.
7. Phase-2 seams documented: what Holy Corner consumes from `bcap-contracts`, what Viewforth will read.

## Exit criteria

- A real advisor completes login → training module → practice assessment on production.
- Restore drill and rollback exercised once each, documented in the runbook.
- Smoke suite green against production.
