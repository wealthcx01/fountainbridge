# FB-030 — Merge ARCA's seeded ticket backlog to the default branch (dogfood)

**Phase:** 1 · **Depends on:** FB-021 (fix repo access) · **Repo:** `wealthcx01/arca` (ticket
tracked from fountainbridge) · **Branch:** `fb-030-arca-dogfood-tickets-on-default-branch`
One ticket = one branch = one PR.

## Why this matters (for the founder)
ARCA is the venture we use to test the studio on ourselves ("dogfood"). Its list of work is
currently sitting on a side branch the studio doesn't read, so the ARCA board looks empty. This
gets that list onto the main branch so the studio shows a real, live board — proof the whole thing
works.

## Context
ARCA's seeded ticket backlog currently lives on the branch **`docs-seed-ticket-backlog`** in
`wealthcx01/arca`, unmerged. The studio reads a repo's **default branch** (`lib/tickets.ts` learns
`default_branch`; arca's is `master`), so the backlog isn't visible. **FB-021** fixes the access +
ref diagnosis and documents that a venture's backlog must live on its default branch; **this
ticket does the actual merge** so arca becomes a live dogfood board. Small, and strictly dependent
on FB-021 landing first (no point merging until access is confirmed working).

## Scope
- Review ARCA's `docs-seed-ticket-backlog` backlog for correctness (tickets follow the house
  format; slugs/numbers sane) and open a PR to merge it into arca's **default branch** (`master`).
- Ensure the merged tickets land under `docs/tickets/` on the default branch so `lib/tickets.ts`
  reads them with no code change.
- Confirm, after merge, that the **arca board renders its real backlog** in the studio (the payoff
  of FB-021 + this).
- Per non-negotiable 2, **this lane opens the PR and stops** — a human merges it per the venture
  approval matrix (D7). "Merge to default branch" here means *open the PR that does so*; the
  actual merge is a human action.

## Out of scope
- Writing new ARCA tickets or changing their content (this is a move-to-default-branch, not
  authoring).
- Any studio code change (FB-021 already handles the reader/diagnosis).

## Acceptance criteria
- [ ] A PR exists moving ARCA's seeded backlog from `docs-seed-ticket-backlog` onto the default
      branch, under `docs/tickets/`.
- [ ] The tickets follow the house format (verified in review).
- [ ] After the human merge, the studio's arca board renders the real backlog (no "not found",
      no empty state).
- [ ] No changes to fountainbridge studio code in this PR.

## Verification
/review; post-merge manual check that the arca board in the studio shows the backlog.
