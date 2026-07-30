# FB-056 — Venture "founding run" (apply meridian's founding run — venture-in-a-day)

**Status:** In review · **Phase:** 5 · **Depends on:** FB-041 (lane loop), FB-050 (gbrain), FB-003
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
- [x] A mission statement produces a north-star + a starter backlog of conventions-compliant tickets
      + `context/`. "Conventions-compliant" is enforced, not hoped for: every generated ticket is
      parsed by the studio's **own** parser (`tools/ticket-parser`, the same module `lib/tickets.ts`
      imports) and must come back with **zero warnings**. The north-star goes to `context/`, not to a
      ticket — it is durable background (D8), not a unit of work that closes.
- [x] The output is filed as a PR a human reviews. `founding-run.sh` never merges; the PR body leads
      with the north-star, lists the backlog, quotes the mission it was given, and says plainly that
      nothing is authoritative until the founder merges.

## Verification
**Done in this PR (local):** 26 unit tests. The tolerant extractor (meridian's pattern) against
fenced/unlabelled/prose-wrapped/truncated output, a brace inside a string, and a prose fence
preceding the real object; strict shape validation that refuses a plan with no north-star, fewer
than 3 tickets, or any ticket without acceptance criteria (naming it); ticket rendering round-tripped
through the real parser for zero warnings, sequential ids, `startAt`, and scope/out-of-scope/
acceptance carry-through; id prefixes (`arca` → ARCA, `the-reset` → TR) including the refusal to
render when a venture id cannot make a legal prefix. Plus an end-to-end dry run of the CLI path the
shell calls — a realistic Chief-of-Staff session → 4 tickets + `context/north-star.md`, each parsing
to a clean `Ticket` through `tools/ticket-parser`'s CLI, and a malformed plan correctly refused with
exit 1. Lint, typecheck, build, UI gate, ticket parse, manifest validation and shellcheck green.

**Still to do on ARCA's box (needs John):** one real founding run — the Chief-of-Staff session itself
needs Claude auth, a venture repo and the GitHub API. The plan logic is unit-tested; what is unproven
is the quality of what a real `/office-hours` + `/plan-ceo-review` session returns for a real mission.
