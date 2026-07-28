# FB-032 — Deterministic health-staleness clock for the e2e (E2E_NOW)

**Status:** In review · **Phase:** 1 · **Depends on:** FB-008 (health strips) · **Repo:** fountainbridge
**Branch:** `fb-032-deterministic-health-clock` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Not founder-facing — this fixes a test that breaks on its own as the calendar moves, which would
otherwise block every PR with a red check for no real reason.

## Context
`lib/health.ts` flags a lane "stale" when there's been no activity in `DEFAULT_STALE_DAYS` (7),
comparing the fixture's last-activity date against the **real** `Date.now()`. The e2e health
fixtures carry fixed dates (arca `2026-07-21`, thereset-platform `2026-01-10`), so once real time
moved a week past `2026-07-21`, arca crossed the 7-day line and computed as *stale* — flipping
`e2e/activity.spec.ts` (which expects arca **active**) from green to red on **every** branch,
unrelated to that branch's changes. A time-dependent test with fixed fixtures is a latent time bomb.

## Scope
- Add a **test-only** clock seam `E2E_NOW`: `loadVentureHealth` uses `defaultNow()`, which returns
  `Date.parse(E2E_NOW)` when that env var is set (and parseable) else `Date.now()`. Same shape as the
  existing e2e seams (`HEALTH_FIXTURE_DIR`, `STALE_AFTER_DAYS`), and must never be set in production.
- Pin `E2E_NOW=2026-07-22T00:00:00Z` in the Playwright `webServer` env so the fixtures read as
  intended (arca active, thereset-platform stale) — deterministically, forever.
- Unit-test `defaultNow` (pins on a valid instant; falls back on empty/unparseable).

## Out of scope
- The humanized "x days ago" display clock (cosmetic; not asserted).
- Reworking the fixtures' dates (the seam is the durable fix).

## Acceptance criteria
- [ ] `e2e/activity.spec.ts` passes deterministically regardless of the real date.
- [ ] `E2E_NOW` only affects behaviour when explicitly set; production uses `Date.now()`.
- [ ] Unit coverage for the seam.

## Verification
/review + unit tests + the Playwright UI gate (activity health strips) green.
