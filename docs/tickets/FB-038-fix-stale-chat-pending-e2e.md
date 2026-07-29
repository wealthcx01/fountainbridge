# FB-038 — Fix stale `venture-chat-pending` e2e assertion (main CI red)

**Status:** In review · **Phase:** 1 · **Depends on:** FB-025 (ARCA chat link went live)
**Repo:** fountainbridge · **Branch:** `fb-038-fix-stale-chat-pending-e2e` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Not founder-facing — it fixes a test that has been failing on `main` for ~a day, which blocks
**every** PR from merging (merge-on-green). Unblocks the whole lane.

## Context
When ARCA's box was provisioned (FB-025), `ventures/arca.yaml` gained `vps.host`, so `VentureBoard`
now renders the live chat link (`data-testid="venture-chat-link"`) instead of the pending note
(`venture-chat-pending`). Commit `6f7a9e1` updated the unit test (`lib/__tests__/ventures.test.ts`)
and `e2e/ventures.spec.ts` for the live state, but **missed** `e2e/tickets.spec.ts:15`, which still
asserts `venture-chat-pending`. That element no longer exists for arca, so the Playwright UI gate
fails — red on `main` since `6f7a9e1` (verified: last 3 `main` CI runs all "failure"). Discovered
while landing FB-033; per non-negotiable 3 it's a separate ticket, not scope creep into that PR.

## Scope
- Update `e2e/tickets.spec.ts` to assert the live chat entry point (`venture-chat-link`) for arca,
  matching its provisioned state and the component's actual output.

## Out of scope
- Any app/behaviour change (the component is correct; only the test assertion was stale).
- FB-033's write-tool work (separate branch/PR).

## Acceptance criteria
- [ ] `e2e/tickets.spec.ts` asserts `venture-chat-link` (live) for arca.
- [ ] The Playwright UI gate passes; `main` CI is green again after merge.

## Verification
CI (lint/typecheck/test + Playwright UI gate) green on the PR.
