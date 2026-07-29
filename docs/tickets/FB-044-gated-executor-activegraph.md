# FB-044 — Gated executor + ActiveGraph approval events (the safety keystone)

**Status:** In review · **Phase:** 2/4 · **Depends on:** FB-037 (design §8), FB-039/040 (lanes)
**Repo:** fountainbridge (+ a control host) · **Branch:** `fb-044-gated-executor-activegraph`
One ticket = one branch = one PR.

## Why this matters (for the founder)
This is what makes an autonomous agent *safe* to run your company: it can *propose* something that
goes outside the building (an email, a deploy) but it can never *do* it. Only you (or the right
person) can grant it, and a separate, locked-down component does the action — never the agent. Every
grant is recorded, so every outside action is defensible.

## Context
Per the design (`docs/founder-to-lane-execution.md` §8, F3/F4): external actions never run on the lane
box (it holds no send/deploy creds). They run in a **separate gated executor** that acts only on a
**human-authored** approval. ActiveGraph's `approval.proposed → approval.granted` is the event log
(here, git-backed for v1). Studied `codejunkie99/meridian-company-os` (MIT) for its approval data
model — adopted its per-approval `checks[]` (named pass/fail policy checks with detail) for our
compliance record; took none of its enforcement (theirs is a UI simulation — ours is a real gate).

## Scope
- **Approval event model** (git-backed, event-sourced on a dedicated `foundry-approvals` ref):
  `approvals/<id>/proposal.json` (a lane/composer proposes an external action; for a send it carries
  the E2 compliance record as **`checks[]`** — recipient class, lawful basis, suppression check,
  frozen draft) → `approvals/<id>/grant.json` (a **human** approver, D7 matrix) →
  `approvals/<id>/execution.json` (the executor).
- **The gated executor** (`deploy/executor/executor.mjs`): reads granted-unexecuted approvals,
  **verifies the git committer identity of the grant is a human approver — NOT the lane** — then runs
  the action with the executor's own creds (a runaway lane's forged grant is rejected + recorded).
  `performAction()` is a stub until real sends (Phase 4b) wire Postmark/Workspace here.
- Docs: the model + the honest identity-separation limit (full strength needs the lane's own machine
  account vs the human approver — the FB-039 lane-identity decision).

## Out of scope
- The studio Approve button that writes `grant.json` as the human (FB-046). Real sends (Phase 4b —
  the executor's stub becomes a Postmark/Workspace call). The lane wiring that emits `proposal.json`
  for a sensitive ticket (a small addition to run-once's stop-at-plan path — fast follow).

## Acceptance criteria
- [x] A human-granted approval → the executor verifies + executes (recorded `execution.json`).
- [x] A **lane-forged grant → REJECTED** (never executed), recorded with the reason + grant author.
- [x] The executor holds its own token; the lane box holds no send/deploy creds (§8).
- [x] The compliance record is modeled as `checks[]` (meridian-inspired).

## Verification
`/review` + CI. Proven live on ARCA's `foundry-approvals` ref: a lane-authored grant was rejected
("grant was authored by the agent lane, not a human approver"); a human-authored grant executed (send
stub). Demo data cleaned up.
