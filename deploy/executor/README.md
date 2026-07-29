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
approvals/<id>/execution.json  ← the executor writes this AFTER acting (or rejecting)
```

## The structural guarantee
`executor.mjs` verifies the **git committer identity of `grant.json`** before acting:
- authored by the **lane identity** → **REJECTED** (a runaway/hallucinating lane cannot approve its
  own action — F3).
- authored by a **human approver** → the action runs, using the executor's creds (never the lane's).

Run it: `node executor.mjs` (env: `REPO`, `EXECUTOR_GITHUB_TOKEN` — its OWN token, `LANE_IDENTITIES`,
`APPROVER_IDENTITIES`).

## Honest limit (identity separation)
The trust anchor is the grant's committer identity. Full strength requires the **lane to have its own
machine GitHub identity distinct from the human approver** — the design's open provisioning question
(a machine account vs the shared account). Today the lane commits with author `lane@bruntsfield.capital`
(supervisor.sh), so a lane-written grant is caught by the deny-list; once the lane has a distinct
GitHub account, the check becomes committer-login based and unforgeable. The mechanism is built now;
this hardening is a provisioning follow-up (FB-039 lane-identity decision).

## Where it runs, and what's real yet
Runs on a control host / the studio side — NOT the venture lane box. `performAction()` is a **stub**
today (no real sends until Phase 4b); when sends go live it calls Postmark/Workspace here with the
executor's creds. The studio Approve button that writes `grant.json` as the human is FB-046.
