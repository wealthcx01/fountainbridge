# FB-058 — Harden the approval path before a founder uses it for real

**Status:** Shipped · **Phase:** 3/4 · **Depends on:** FB-051 (provenance), FB-054 (budget
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
- [x] **Approving a proposal that changed since it was rendered is refused.** The card sends the sha
      it rendered from; the action compares it against what it is about to sign and stops if they
      differ. A blob sha is content-addressed, so this is an exact-content check rather than a
      timestamp comparison. Optional, so a card rendered before this shipped still works.
- [x] **The provenance warning has coverage that fails if it is removed.** Two adversarial fixtures:
      a forged attestation of the kind a lane could write, and a genuinely studio-signed grant pinned
      to a proposal that then changed. Both were run through the real read path to confirm they
      produce the reason kinds the tests assert, rather than assumed to.
- [x] **A test placed beside the approve server action actually runs.** Two things were stopping it —
      `app/` was outside the vitest include, and the `@/` path alias was not resolved there. 14 tests
      now cover the action, including the D7 denial that had none at all.
- [x] **Two approvals with the same id in different department repos render without colliding.** Test
      ids are repo-qualified, matching the React key.

## What the new tests found

Writing the coverage immediately surfaced a fifth gap that none of the three tickets had recorded:
**`granted`, `executing`, `executed` and `rejected` approvals rendered nowhere.** The board showed
`proposed` and, since FB-051, `failed`/`unverified-action` — so a founder clicked Approve on
something irreversible and watched the card disappear, with no evidence anything was queued, and it
only came back into view if it later went wrong. Fixed here rather than deferred: it is the same
silent gap FB-051 closed for failures, in a worse place, on the surface Ross is about to use.

## The fixture trap this closed on the way

`make sign-approval-fixtures` re-signs every grant it finds, so it would have quietly repaired both
adversarial fixtures the first time anyone ran it — leaving three tests passing while testing
nothing. Grants now opt out with an `_adversarial` field and the script reports what it skipped.
Same species as FB-054's finding that a fixture authored alongside a feature can encode the same
wrong assumption and certify the bug.

## Also: venture isolation is now pinned to the real manifests

Not in the original scope. Added because John asked whether Ross would see only THE RESET, and the
honest answer was that no test knew. Every authz test ran against **invented** ventures, with an
address (`ross@thereset.com`) that stopped being real when D3 was amended to the shared Bruntsfield
Workspace. The logic was proven; the deployed configuration was not. A manifest edit could have
handed a founder someone else's venture, or put one in the admin list, and nothing would have failed.

`lib/__tests__/authz.test.ts` now reads `ventures/*.yaml` and the production admin list, asserting
**per venture** rather than by count so a fourth venture cannot quietly pass: Ross sees `the-reset`
and nothing else, John sees all three, and a Workspace address belonging to nobody sees none —
signing in is not authorisation, and the OAuth consent screen is Internal to the whole Workspace.

## Still open
- ⚠ **The execution record remains lane-authored** (FB-051's larger gap). Signing it, and giving the
  executor an idempotency ledger outside the lane-writable ref, changes the executor and is its own
  ticket.

## Verification
385 unit tests + 6 new Playwright over the approval card. **Mutation-checked by doing it, not by
assuming it:** removing the sha binding, the repo allowlist, or the D7 check each turns exactly one
test red, and all three were restored afterwards.
