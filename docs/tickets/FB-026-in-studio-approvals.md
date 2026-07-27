# FB-026 — In-studio approvals (attention queue → Approve action)

**Phase:** 3 · **Depends on:** FB-007 (attention queue v0), FB-020 (repo reads), FB-021 (boards
populate) · **Repo:** fountainbridge
**Branch:** `fb-026-in-studio-approvals` · One ticket = one branch = one PR.

## Why this matters (for the founder)
When something needs your go-ahead, you should be able to read a plain-English summary of what it
is, click through to see it, and hit **Approve** — right there in the studio. No GitHub, no jargon.
This turns the "things waiting on you" list from a read-only notice into something you can act on.

## Context
`docs/parity-critique.md` §3 flags previews and the **founder review experience** as a gap: today
the attention queue (FB-007) *lists* open PRs but the founder can't act on them in-studio — and
the copy is operator-shaped ("the workshop never merges…"). The phased plan puts **in-studio
approvals** in **Phase 3**. Governance is **D7**: each manifest carries an approval matrix —
founder approves product-visible changes, Bruntsfield approves platform/infra/security,
**dual-approve** for high-blast-radius (migrations, auth, payments, secrets, external sends). This
ticket gives each attention item a plain-language summary, a preview link, and an **Approve**
action that **merges via the GitHub API** — routed to the right approver(s) per the matrix.

## Scope
- **Plain-language summary** per attention item: what the change is, in founder terms (not a raw
  PR title/diff). Reuse/inform from the FB-024 glossary so wording is consistent.
- **Preview link:** a way to see the change before approving (link to the rendered preview / PR
  view — the concrete preview surface can be the PR page for v1, richer preview later).
- **Approve action:** an in-studio button that performs the merge **via the GitHub API** for that
  PR. This is the one place the studio is allowed to merge — and only on a recorded human approval
  (non-negotiable 4: `approval.proposed` → `approval.granted`; nothing external executes without a
  recorded human approval). Record the approval event.
- **D7 routing:** read the venture manifest's approval matrix and route each item to the correct
  approver(s) — founder / Bruntsfield / dual-approve — and only enable Approve for a signed-in
  user who is an authorised approver for that item's class. Dual-approve items require **both**
  recorded approvals before merge.
- **Server-side enforcement** of who may approve what (non-negotiable 6 — never trust the UI).

## Out of scope
- The conversational composer (FB-025) and the write/create-ticket path.
- Non-PR external actions (email/social/CRM/payments via ActiveGraph) — those are Phase 4b.
- Changing branch-protection / `main` server-side rules (humans-merge-per-matrix stays; this
  action *is* the human, recorded).

## Acceptance criteria
- [ ] Each attention item shows a plain-language summary + a preview/PR link.
- [ ] An authorised approver can Approve in-studio, which merges the PR via the GitHub API and
      records the approval event.
- [ ] Routing follows the manifest's D7 approval matrix; unauthorised users cannot approve
      (enforced server-side).
- [ ] Dual-approve items require both recorded approvals before merge.
- [ ] No merge occurs without a recorded human approval.

## Verification
/plan-ceo-review before build; /review + /qa + unit tests for the routing/authorisation logic;
manual walkthrough of a founder-class approve and a dual-approve.
