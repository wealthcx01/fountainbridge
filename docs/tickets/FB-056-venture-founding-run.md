# FB-056 — Venture "founding run" (apply meridian's founding run — venture-in-a-day)

**Status:** Planned · **Phase:** 5 · **Depends on:** FB-041 (lane loop), FB-050 (gbrain), FB-003
(manifest) · **Repo:** fountainbridge · **Branch:** `fb-056-venture-founding-run` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Day one: you describe the mission in a paragraph and the studio comes back with a north-star, the first
goals, and a starter backlog already on your board — the venture bootstrapped, not a blank repo.

## Context
Meridian's `executeFoundingRun` / `parseFoundingPlan` (`docs/ideas-from-meridian.md`): a Chief-of-Staff
agent turns a mission into a strict-JSON `FoundingPlan` (north-star + goals + starter tasks + hires),
with a tolerant JSON extractor. Directly serves Phase 5 "venture-in-a-day" — seed a new venture's
`docs/tickets/` + `context/` from a mission, through gstack `/office-hours` + `/plan-ceo-review`.

## Scope
- A **founding run**: mission statement → a Chief-of-Staff lane (gstack `/office-hours` +
  `/plan-ceo-review`) produces a north-star + starter tickets (house format) + initial `context/`.
- Files the starter backlog as PRs (a human OKs) so the new venture opens with real, plain-language work.
- A tolerant structured-output parser (meridian's pattern) for the plan JSON.

## Out of scope
- Provisioning the VPS/repo (FB-011/039) — this seeds *content* into an existing venture.

## Acceptance criteria
- [ ] A mission statement produces a north-star + a starter backlog of conventions-compliant tickets + `context/`.
- [ ] The output is filed as PRs a human reviews (nothing auto-merges).

## Verification
`/review` + a dry run: a sample mission yields a coherent north-star + ≥3 valid starter tickets.
