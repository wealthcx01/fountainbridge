# FB-046 — In-studio approvals: the founder-facing end of the gate

**Status:** Done · **Phase:** 3 · **Depends on:** FB-044 (gated executor + attestation), FB-007
(attention queue) · **Repo:** fountainbridge · **Branch:** `fb-046-studio-approve-endpoint`
One ticket = one branch = one PR.

## Why this matters (for the founder)
When something wants to go outside the building — an email, a deploy — you see it in the studio in
plain language, with the checks that were run, and one button: **Approve**. You never open GitHub, and
nothing goes out until you say yes. This is the par-plus surface Cofounder wraps as an inbox; ours is
backed by a real, unforgeable gate.

## Context
FB-044 built the gated executor that runs an external action only on a grant carrying a valid HMAC
**attestation**. FB-046 is the studio end: render proposed approvals as founder-grade cards, and — on
Approve — verify the human + their D7 role and **issue that attestation** (the studio holds the shared
secret; the lane never does). Adopted meridian's `checks[]` inbox framing ("policy checks clear / N
failing"); the enforcement is ours.

## Scope
- **Read model** (`lib/approvals.ts`): read the venture's `foundry-approvals` ref (proposal/grant/
  execution), derive status (proposed→granted→executing→executed/rejected), surface proposed ones
  first. Injectable source (unit-tested offline); a read failure never blanks the board.
- **Attestation + D7** (`lib/approval-attestation.ts`): `attestationFor()` — byte-identical to the
  executor's formula (pinned by a compat test vector); `approverRoleForDepartment()` routes an
  external action to the manifest's `high-blast-radius` approver; `canApprove()` — deny-by-default
  role check. `lib/ventures.ts` now parses `approval_matrix`.
- **Approve server action** (`app/actions/approvals.ts`): session + venture authz + D7 role → pin the
  proposal sha → sign → write `grant.json` with a **write-scoped** token (never the read App, never the
  lane). Refuses if already granted/executed, or if the studio isn't configured (secret/token absent).
- **UI** (`ApprovalCard` + board section): plain-language summary + the `checks[]` + an Approve button.

## Out of scope
- Real sends (Phase 4b — the executor's stub). Full dual-sign (v0 records the approver; a second
  signer is a follow-up). The lane wiring that emits `proposal.json` for a sensitive ticket (fast follow).

## Deploy (studio env — shared with the executor)
- `FOUNDRY_APPROVAL_SECRET` — the HMAC secret, **identical** in the studio and the executor; never on
  a lane box.
- `STUDIO_APPROVAL_GITHUB_TOKEN` — a write-scoped token for the `foundry-approvals` ref (the read App
  stays read-only).

## Acceptance criteria
- [x] `attestationFor()` matches the executor (pinned vector; case-insensitive approver; sha-pinned).
- [x] D7 routing + `canApprove()` deny-by-default (unit-tested).
- [x] The read model surfaces proposed approvals + maps `checks[]` (unit-tested); a missing ref → none.
- [x] The Approve action gates on session + authz + D7 and fails graceful when unconfigured.
- [x] The board renders a "Needs your OK" card with checks + Approve (typecheck/lint/tests green).

## Verification
`/review` + CI (17 unit tests incl. the studio↔executor attestation compat vector; typecheck; lint).
The live click→grant→executor loop activates once the studio carries the shared secret + write token
(deploy step) — the attestation compatibility is proven by the pinned vector.
