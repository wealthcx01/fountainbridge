# FB-002 — Extend bcap-contracts with Foundry Studio entities

**Phase:** 0 · **Depends on:** — (parallel with FB-001) · **Repo:** bcap-contracts
**Branch:** `fb-002-fountainbridge-entities` · One ticket = one branch = one PR.

## Context
Decision D4 (v2): bcap-contracts is the shared type system where studios meet Holy Corner — grassmarket already consumes it; fountainbridge renders these entities in the studio. Scope deliberately limited to a type system, not a platform.

## Scope
Add models (JSON Schema export + generated TS types per the package's existing pipeline):
- `Venture` — id, name, status, tier3_ref?, **vps** {host, provider, provisioned_at}, **founder** {name, github_login, workspace_email — the Bruntsfield-assigned venture-domain Google account, e.g. ross@thereset.com; never a personal @gmail.com}, **approval_matrix** (D7: rules mapping change class — product-visible / platform-infra / high-blast-radius — to required approver(s): founder | bruntsfield | dual), repos[], lanes[], departments[], connectors[].
- `Lane` — id, venture_id, repo, tmux binding, standing_order, status.
- `Ticket` — id (e.g. FB-001), repo, path, title, phase, depends_on[], status (todo/in-progress/pr-open/done), branch, pr_url?, body_md.
- `Approval` — id, venture_id, kind (`pr` | `activegraph_policy` — kind list extensible pending FB-012), source_ref, summary, requested_at, state (pending/approved/rejected), decided_by?, decided_at?.
- `Department` — id, venture_id, name, repo, queue_path, connectors[], gate (`pr` | `activegraph` | `tbd-fb012`).
- `RunReport` — lane_id, started_at, ended_at, trigger (manual/scheduled), summary_md, tickets_touched[], outcome (progress/no-useful-work/error), error_detail?.

## Out of scope
Any consumer code; scheduler semantics beyond RunReport; GTM gate specifics (post-FB-012 follow-up ticket if the Approval/Department contracts need extending).

## Acceptance criteria
- [ ] Models + validation tests; JSON Schemas and TS types generated and committed per package convention.
- [ ] Round-trip fixtures for each entity validate and serialize both directions.
- [ ] Version bump + changelog; no breaking changes to existing grassmarket-consumed contracts (CI proves it).

## Verification
/review + /qa; grassmarket's contract-consumption tests still green against the new version.
