# FB-042 — RunReport + Department contracts, studio read model, and the founder brief

**Status:** Planned · **Phase:** 2/3 · **Depends on:** **bcap-contracts (FB-002 lane)** for the
`RunReport` + `Department` types; FB-040 (lanes write RunReports) · **Repo:** fountainbridge (+
bcap-contracts) · **Branch:** `fb-042-runreport-contract-and-brief` · One ticket = one branch = one PR.

## Why this matters (for the founder)
You always see, in plain language, what the agents did, what's stuck and why, and a short daily brief
of your whole venture — so nothing ever fails silently and you're never surprised.

## Context
Lanes already write RunReports to the `foundry-state` ref (FB-040), but as ad-hoc JSON — there's no
contract and no studio read surface. This lands the typed contract (via the shared package) + the
studio surface, and applies meridian's `RunRecord` shape + auto-brief (`docs/ideas-from-meridian.md`).

## Scope
- **Contract (bcap-contracts / FB-002 lane):** a `RunReport` type — `{ ticket, lane, status:
  working|blocked|opened_pr|failed|idle, source: manual|autopilot|composer, summary, pr_url?, error?,
  startedAt, finishedAt, durationMs?, tokens?, costUsd? }` (the `source`/cost/token fields from
  meridian's `RunRecord`) + the `Department` type. Consumed here as generated TS.
- **Studio read model** (`lib/runreports.ts`) + a lane-activity strip: what the engine is doing/did/why
  it's stuck, in plain language (non-negotiable 10), reusing FB-008 staleness for "engine offline".
- **Founder brief** (meridian `plainBrief`): an auto-generated plain-language digest from RunReports +
  open PRs + pending approvals + lane staleness (+ budget risk once FB-054 lands).

## Out of scope
- The autonomous-lane mechanics (FB-040). Publishing the contract itself (that's the FB-002 lane's PR).

## Acceptance criteria
- [ ] `RunReport` + `Department` types published in bcap-contracts and consumed here (generated TS).
- [ ] The studio renders lane RunReports (incl. blocked/failed reasons) + flags an offline engine.
- [ ] An auto-generated founder brief composes from live state.

## Verification
`/review` + CI; the studio shows a real RunReport from ARCA's `foundry-state` ref; the brief renders.
