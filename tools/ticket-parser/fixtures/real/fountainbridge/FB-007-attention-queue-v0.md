# FB-007 — Attention queue v0: PRs awaiting the human gate

**Phase:** 1 · **Depends on:** FB-005, FB-006 · **Repo:** fountainbridge
**Branch:** `fb-007-attention-queue` · One ticket = one branch = one PR.

## Context
The single most valuable Cofounder pattern to copy: one funnel for everything needing a human. v0 scope is the engineering gate only — open PRs across the venture's repos awaiting review (the workshop never merges; every open workshop PR is by definition awaiting a human). GTM/ActiveGraph approvals join this queue in Phase 3–4, shaped by FB-012.

## Scope
- Attention view (venture-scoped): open PRs across the venture's manifest repos — title, repo, lane, linked ticket id (via FB-004 hook: branch/title referencing ticket ids), CI status, UI-gate screenshot thumbnail if present, **Vercel preview URL surfaced as the primary click target** (parity critique §3: a founder clicks a link and sees the change; the diff is the power path), age.
- Sort oldest-first; badge count in nav.
- Items link to the GitHub PR for the actual review/merge (no in-app merge in v0 — the gate stays on GitHub, where both John and the founder's own GitHub account can review).
- Ticket status inference lands here: open PR → `pr-open` in FB-006 views, merged → `done` (shared server-side data layer, one GitHub fetch pass).
- Modeled as `Approval` entities (kind=`pr`) so later gate kinds are additive, not a rewrite.

## Out of scope
Non-PR approval kinds (post-FB-012); snooze/dismiss (Phase 3); acting on PRs in-app.

## Acceptance criteria
- [ ] Queue matches GitHub's open-PR list for ARCA's repos (spot-check in PR).
- [ ] Ticket statuses update from PR state without API quota blowout (measured request counts in PR).
- [ ] Playwright + UI-gate coverage.

## Verification
/review + /qa + UI-gate gallery.
