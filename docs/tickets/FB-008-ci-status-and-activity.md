# FB-008 — CI/lane-health + activity feed

**Phase:** 1 · **Depends on:** FB-005, FB-006 · **Repo:** fountainbridge
**Branch:** `fb-008-ci-activity` · One ticket = one branch = one PR.

## Context
Completes the read-only studio: at a glance, is every lane of the venture healthy and what shipped recently. Also the first surface for spotting silent lane death — which becomes a scheduler concern in Phase 2 and a founder-facing guarantee in Phase 3 (a founder must never wonder whether their company's agents are actually working).

## Scope
- Per-repo health strip: latest CI run on main (status/time), latest UI-gate gallery link, branch-protection-on badge.
- Activity feed (venture-scoped, filterable by repo): merged PRs, new tickets, CI failures — last 14 days.
- Staleness flag: lane with no commit/PR/ticket activity in N days (configurable per lane in the manifest) renders a warning on FB-006 views.
- GitHub Actions API added to the shared data layer.

## Out of scope
RunReports (Phase 2 — the scheduler writes those); alerting/notifications (Phase 2+).

## Acceptance criteria
- [ ] Health strip accurate against GitHub Actions for ARCA's repos.
- [ ] Staleness flag fires on a known-stale fixture and not on active lanes.
- [ ] Playwright + UI-gate coverage.

## Verification
/review + /qa + UI-gate gallery.
