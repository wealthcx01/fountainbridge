# Foundry gated executor (FB-044) — the external-action safety keystone

External actions (email/sends/deploys/payments) **never** run on the venture lane box (it holds no
such creds — design §8). They run in this **separate** component, which holds those creds and acts
only on a **human-approved**, event-sourced approval. This is what makes an autonomous lane safe: it
can *propose* an external action but can never *perform* one.

## The approval lifecycle (git = the audit log, on a dedicated `foundry-approvals` ref)
```
approvals/<id>/proposal.json   ← a lane/composer proposes an external action
                                 (for a send: the E2 compliance record — recipient class, lawful
                                  basis, suppression check, frozen draft; research-gtm §5)
approvals/<id>/grant.json      ← a HUMAN approver grants it (the studio Approve button; D7 matrix)
approvals/<id>/execution.json  ← the executor writes this AFTER acting: executing | executed | failed | rejected
#                                (FB-051 added `failed`; before it, a throw left the record at `executing` forever)
```

## The guarantee (rebuilt after adversarial review)
The lane can write ANY file to the repo and set any git author/committer — so authority can't rest on
file contents or git-commit identity. (Confirmed: GitHub does **not** sign contents-API commits — they
are `verified:false` — and `committer.login` is email-derived and forgeable. Git authorship is not a
sound anchor.) The unforgeable signal is a **server-issued HMAC attestation**, and the executor **fails
closed**:
- **Fail closed:** missing `EXECUTOR_GITHUB_TOKEN`, `FOUNDRY_APPROVAL_SECRET`, or `APPROVER_IDENTITIES`
  → the executor refuses to run. An empty allowlist means "no one is authorised", not "anyone".
- **Studio-signed grant:** `grant.json` must carry `{approver, proposal_sha, attestation}` where
  `attestation = HMAC-SHA256(FOUNDRY_APPROVAL_SECRET, "<id>|<proposal_sha>|<approver>")`. The STUDIO
  issues it on a human Approve (Google-OAuth session + D7 role); the executor re-computes + timing-safe
  compares. **A lane cannot forge it — the secret lives only in the studio + executor, never on the
  lane box** (§8). The approver must be on the allowlist.
- **Proposal pinned:** the attestation covers `proposal_sha`, so a proposal swapped after approval
  (TOCTOU) fails the check.
- **Robust:** a transient read error skips-and-retries (never a wrong terminal rejection); "executing"
  is recorded before the action so a crash can't cause a silent re-run.

Run it: `node executor.mjs` (env: `REPO`, `EXECUTOR_GITHUB_TOKEN`, `FOUNDRY_APPROVAL_SECRET`,
`APPROVER_IDENTITIES`).

## What lands next
The studio endpoint that verifies the logged-in human + D7 role and **issues the attestation** on
Approve is **FB-046** (it holds the secret; the lane never does). `performAction()` is a stub until real
sends (Phase 4b), where the executor's own Postmark/Workspace creds run it — never the lane's.

## Where it runs, and what's real yet
Runs on a control host / the studio side — NOT the venture lane box. `performAction()` is a **stub**
today (no real sends until Phase 4b); when sends go live it calls Postmark/Workspace here with the
executor's creds. The studio Approve button that writes `grant.json` as the human is FB-046.
