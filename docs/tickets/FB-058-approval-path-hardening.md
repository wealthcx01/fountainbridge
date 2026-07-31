# FB-058 — Harden the approval path before a founder uses it for real

**Status:** Planned · **Phase:** 3/4 · **Depends on:** FB-051 (provenance), FB-054 (budget
disclosure), FB-045 (department repos) · **Repo:** fountainbridge ·
**Branch:** `fb-058-approval-path-hardening` · One ticket = one branch = one PR.

## Why this matters (for the founder)
The Approve button is the one place in the studio where a click causes something irreversible to
happen to real people. Three tickets landed around it while carrying known gaps, each recorded
honestly and each deferred. This is the ticket that closes them, before Ross ever presses it.

## Context
FB-051, FB-054 and FB-045 each shipped with a "Still open" list. Taken individually they were
reasonable deferrals. Taken together they describe a surface where the most consequential control in
the product has no automated test proving it renders its warning, and where the thing signed is not
provably the thing the founder was looking at.

## Scope

1. **Bind the approve click to the proposal the founder saw.** `proposalSha` is computed in the read
   model and never used: the server action re-reads and signs whatever is current, so a proposal
   swapped between render and click is signed unexamined. Verification catches it afterwards (the sha
   stops matching and the card says so) but nothing prevents it. Pass the rendered sha with the click
   and refuse when it has moved, with a message that says the proposal changed and to re-read it.

2. **Give the approval card real test coverage.** `APPROVALS_FIXTURE_DIR` is wired for the venture
   page but there is no component or e2e coverage of the provenance render itself — the only place
   the "the studio cannot verify this" warning reaches a human is deletable without failing a test.
   The FB-054 signing script (`make sign-approval-fixtures`) makes attested fixtures possible; add
   the unattested, changed-proposal and failed-execution cases beside them.

3. **Bring `app/` inside the test boundary.** The vitest include does not cover `app/`, so a test
   placed next to the approve server action silently never runs — which is why its D7 denial path,
   its unconfigured-secret path and now its repo allowlist are all untested. Extend the glob, or move
   the logic into `lib/` behind a thin action.

4. **Make the DOM test ids repo-qualified.** Since FB-045 an approval id is unique only within its
   department's repo. React keys and the approve call carry the repo; `data-testid` does not, so two
   departments with an identically-named ticket would collide in the UI gate.

## Out of scope
- Signing the execution record and giving the executor an idempotency ledger outside the
  lane-writable ref (FB-051's larger "still open" — its own ticket, and it changes the executor).
- The real send transport (Phase 4b).

## Acceptance criteria
- [ ] Approving a proposal that changed since it was rendered is refused, with a plain-language
      reason, and a test proves it.
- [ ] The unattested-grant warning, the changed-proposal case and a failed execution each have
      coverage that fails if the render is removed.
- [ ] A test placed beside the approve server action actually runs, and the D7 denial is one of them.
- [ ] Two approvals with the same id in different department repos render without colliding.

## Verification
`/review` + CI, including a mutation pass over the approval boundary: deleting the provenance render,
the sha check, or the repo allowlist must each turn something red.
