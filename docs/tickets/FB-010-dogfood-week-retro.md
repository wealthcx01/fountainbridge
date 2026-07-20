# FB-010 — Dogfood week on THE RESET (+ARCA) + retro → Phase 2 ticket set

**Phase:** 1 (close-out) · **Depends on:** FB-009 · **Repo:** fountainbridge
**Branch:** `fb-010-phase1-retro` · One ticket = one branch = one PR.

## Context
Decision D5 (revised): THE RESET is the studio's launch venture — and since John is a Reset co-founder, running Reset daily through the studio *is* the dogfood. ARCA rides along as the lower-stakes fixture. One week of running both through fountainbridge instead of tmux + GitHub tabs, then a structured retro that produces the Phase 2 tickets.

## Scope
- Dogfood protocol: for 5 working days, Reset's (and ARCA's) morning triage and PR review happen through the studio; every friction point logged as a `docs/tickets/` entry tagged `dogfood` (however small). Ross's venture-scoped view checked at least twice in the week (the Ross-test, live).
- /retro at week's end covering: what still forced a fall-back to shell/GitHub tabs; data staleness pain; attention-queue signal-to-noise; mobile gaps; anything that would confuse a non-John founder (Ross-test: would Ross understand this screen cold?).
- Deliverable in the PR: `docs/retro-phase1.md` + drafted Phase 2 ticket set (FB-013+) covering the write path (studio → ticket commit) and the per-venture VPS scheduler (systemd timers, standing orders, useful-work pre-check, RunReports) — scoped from retro evidence, one ticket = one branch = one PR.

## Out of scope
Building any Phase 2 functionality; THE RESET onboarding (Phase 3, needs FB-011 + Phase 2).

## Acceptance criteria
- [ ] ≥5 dogfood days logged; friction tickets filed.
- [ ] Retro doc + Phase 2 tickets merged; sequencing agreed (dependencies declared per ticket).

## Verification
/retro output reviewed via normal PR gate.
