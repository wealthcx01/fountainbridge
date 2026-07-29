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
**human-approved** approval. ActiveGraph's `approval.proposed → approval.granted` is the event log
(here, git-backed for v1). Studied `codejunkie99/meridian-company-os` (MIT) — adopted its per-approval
`checks[]` (named pass/fail policy checks with detail) for the compliance record; took none of its
enforcement (theirs is a UI simulation).

**The trust anchor — decided after adversarial review.** The lane can write any file to the repo and
set any git author/committer, and (confirmed) GitHub does **not** sign contents-API commits, so
git-commit authorship is **not** a sound gate. The unforgeable signal is a **server-issued HMAC
attestation**: the STUDIO (server-authoritative, where a human approves via Google-OAuth + the D7
matrix) signs the grant with a secret held only by the studio + executor — **never on the lane box**
(§8). A lane can write a `grant.json` but cannot forge the signature.

## Scope
- **Approval event model** (git-backed, event-sourced on a dedicated `foundry-approvals` ref):
  `approvals/<id>/proposal.json` (a lane/composer proposes an external action; for a send it carries
  the E2 compliance record as **`checks[]`** — recipient class, lawful basis, suppression check,
  frozen draft) → `approvals/<id>/grant.json` (a **human** approver, D7 matrix) →
  `approvals/<id>/execution.json` (the executor).
- **The gated executor** (`deploy/executor/executor.mjs`): reads granted-unexecuted approvals and
  **fails closed** (no executor token / no shared secret / no approver allowlist → refuses). It honours
  a grant only if it carries a valid **HMAC attestation** (`HMAC(secret, "<id>|<proposal_sha>|<approver>")`,
  approver on the allowlist), which also **pins the proposal** (a post-grant swap is rejected). Records
  "executing" before acting (crash-safe) and is idempotent. `performAction()` is a stub until Phase 4b
  wires Postmark/Workspace with the executor's own creds (never the lane's).
- Docs: the attestation model; the studio Approve endpoint that issues attestations = FB-046.

## Out of scope
- The studio Approve button that writes `grant.json` as the human (FB-046). Real sends (Phase 4b —
  the executor's stub becomes a Postmark/Workspace call). The lane wiring that emits `proposal.json`
  for a sensitive ticket (a small addition to run-once's stop-at-plan path — fast follow).

## Acceptance criteria
- [x] Fail-closed: missing executor token / shared secret / approver allowlist → the executor refuses.
- [x] A **studio-signed grant** (valid attestation, allowlisted approver, pinned proposal) → executed
      (crash-safe two-phase record; idempotent on re-run).
- [x] A **lane-forged grant** (no valid attestation) → REJECTED, recorded with the reason.
- [x] The executor holds its own token + the secret; the lane box holds neither, and no send/deploy
      creds (§8). Compliance modeled as `checks[]` (meridian-inspired).

## Verification
`/review` + independent adversarial security review (found 3× P0 + P1s in the first git-authorship
design — rebuilt to the attestation model; all addressed). Proven live on ARCA's `foundry-approvals`
ref: fail-closed refused; a lane-forged grant was rejected ("attestation invalid — a lane cannot forge
it"); a studio-signed grant executed (send stub); a second run was idempotent. Demo data cleaned up.
