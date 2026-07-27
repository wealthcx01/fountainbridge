# FB-021 — Fix repo access: venture boards render empty ("repository not found")

**Phase:** 1 · **Depends on:** FB-020 · **Repo:** fountainbridge
**Branch:** `fb-021-fix-repo-access-boards-empty` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Right now the studio shows your venture as an empty board with a scary "repository not
found" message, even though the work is really there. This makes the whole studio look broken
on day one. Fixing it is the top priority: it's the difference between "my studio works" and
"my studio is empty."

## Context
The live studio renders every venture board as **"Repository wealthcx01/… not found (not
provisioned yet?)"** (the message from `lib/tickets.ts:123`) even though `wealthcx01/arca`
exists. Two independent root causes are suspected and both must be checked:

- **(a) App access.** The FB-020 GitHub App may not be **installed on the venture repos**, or
  its installation may lack **`contents: read`** (and repo metadata). A 404 from
  `GET /repos/{owner}/{repo}` looks identical to "repo doesn't exist" when the token can't see
  it — so an install/permission gap presents as "not found."
- **(b) Wrong ref.** `lib/tickets.ts` reads the repo's **default branch** (`master`/`main`), but
  ARCA's ticket backlog currently lives on an **unmerged branch** `docs-seed-ticket-backlog`.
  Even with correct access, the default branch has no `docs/tickets/`, so the board is empty.

This is the top live bug. FB-030 (merge ARCA's backlog to the default branch) depends on this
ticket landing first.

## Scope
- **Diagnose access first.** Confirm whether the FB-020 App is installed on `wealthcx01/arca`
  and what repository permissions the installation grants. Document the exact install + scope
  requirement (App installed on the venture repo, `contents: read` + metadata) in
  `docs/provisioning.md` (or `docs/deploy.md`) as the canonical **repo onboarding** step.
- **Fix the founder-facing failure surface.** Distinguish the three real states so the studio
  never conflates them: (1) repo genuinely absent, (2) App not installed / insufficient scope
  (an *access* problem, not "not provisioned"), (3) reachable but no `docs/tickets/` on the read
  ref (an *empty backlog*, possibly because the tickets are on another branch). Surface each in
  plain language per non-negotiable 10 ("fail loud, surface everything").
- **Get the arca board to populate.** With the App correctly installed/scoped and tickets on a
  branch the studio reads, `wealthcx01/arca` must render its real tickets. If the only blocker
  is that tickets sit on `docs-seed-ticket-backlog`, this ticket documents that requirement and
  FB-030 does the merge; do **not** hard-code a non-default branch into the reader.
- **Write the onboarding runbook:** a short checklist for how a venture repo must be prepared —
  App installed on the repo, `contents: read`, and its ticket backlog on the **default branch**.

## Out of scope
- Merging ARCA's `docs-seed-ticket-backlog` branch (that is **FB-030**, which depends on this).
- The write path / approval events (reads only here).
- Reading tickets from a non-default branch as a permanent feature (default branch is the
  contract; git = source of truth on the default branch).

## Acceptance criteria
- [ ] Root cause identified and stated in the PR: which of (a) install/scope and/or (b) wrong
      ref was responsible, with evidence.
- [ ] With the App correctly installed and scoped, and arca's tickets on the read ref, the
      **arca board renders its real tickets** (no "not found").
- [ ] The three failure states (absent / no-access / empty-backlog) are surfaced distinctly in
      plain language — a founder can tell "not set up yet" from "something's wrong."
- [ ] `docs/provisioning.md` (or `deploy.md`) documents the repo-onboarding requirement: App
      install + `contents: read` + backlog on the default branch.
- [ ] Regression coverage for the no-access vs empty-backlog distinction.

## Verification
/review + /qa + unit tests (`lib/__tests__/tickets.test.ts`) + manual check against
`wealthcx01/arca`.
