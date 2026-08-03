# FB-094 — The studio reads repos that do not exist

**Status:** Done · **Phase:** 3 · **Found by:** the FB-090-style founder walkthrough John asked for
on 2026-08-03, driven against a production build carrying production environment · **Repo:**
fountainbridge · **Branch:** `fb-094-the-studio-reads-repos-that-do-not-exist` ·
One ticket = one branch = one PR.

## What the founder saw

ARCA's board, signed in as `arca.founder@bruntsfield.capital`, said:

> *No sign of an agent lane on this venture yet — it starts with your box.*

At that moment the box's lane had written a heartbeat — *"Lane awake — nothing to work right now"*
— **fifteen minutes earlier**, and had merged a real ticket into the product eighty-seven minutes
earlier. Twenty-seven run reports sat on the `foundry-state` ref. The board flatly contradicted the
brief two lines above it, which admitted *"some of this venture's state could not be read"* — two
bullets in the same summary, one saying nothing has ever happened, one saying we cannot tell.

## The defect

Manifests declare repos as bare slugs (`arca`, `arca-marketing`). GitHub's API is addressed by
`owner/slug`. Three read/write paths passed the bare slug straight through:

- **Run reports** — `githubRunReportSource` listed `/repos/arca/runreports` → 404 → swallowed into
  "no reports" → "no sign of an agent lane".
- **Approvals** — `githubApprovalSource` listed `/repos/arca-marketing/approvals` → 404 → an empty
  queue. In any real deployment, a Sell department's proposal could **never reach the founder** —
  the exact surface non-negotiable 4 exists for. A gate nobody can see is not a gate.
- **The approve action** — read the proposal from, and wrote the grant to, the bare slug (404), and
  **signed the attestation over the bare slug**. The box's executor recomputes that HMAC over its
  `REPO` env, which is `owner/slug` — so even a grant that had somehow been written would have been
  refused as forged. The approval loop was broken end-to-end, twice over.

## Why every check was green

The e2e fixture directories are keyed by the **bare slug** (`e2e/fixtures/approvals/arca/…`), so
the fixture source and the real source disagreed about what a repo is called — and only the fixture
one was ever exercised by CI. 655+ unit tests and the full Playwright suite proved the code against
fixtures named the way the bug expected. This is FB-087's lesson — *a local suite proves the code,
never the deployment* — repeated on the read side, and it is why the fix pins the boundary in unit
tests that mock the GitHub client and assert the exact URL-forming string.

## The fix: one rule at one boundary

`fullRepoName(repo, org?)` in `lib/venture-repos.ts`: prefix a bare slug with the org
(`GITHUB_ORG`, default `wealthcx01`); pass an already-qualified name through untouched. Applied at
the GitHub/attestation boundary and **nowhere else** — manifest slugs remain the internal keys for
fixtures, ActiveGraph paths (which already normalise via `split('/').pop()`), and display:

- `githubRunReportSource` and `githubApprovalSource` prefix before every API call.
- The approve action reads, writes, verifies and **signs over the full name** — matching the
  executor byte for byte. The grant's `repo` field now carries the full name too.
- `sign-approval-fixtures.mjs` signs over the full name (fixtures regenerated; the two adversarial
  fixtures stay deliberately unsigned).
- The run-report `list()` no longer swallows non-404 failures: `listDir` already reads a missing
  state ref (404) as empty, so anything else is a real fault and now surfaces as *"could not be
  read"* instead of a calm, false *"no lane"* (CLAUDE.md #10 — quiet and broken must never render
  the same).

## Explicitly NOT in this pull request

- The rest of the walkthrough's findings (raw engine errors shown to the founder, `ARCA-NEW`
  numberless tickets, "MERGED" activity entries for ticket *filings*, copy issues). Filed as their
  own tickets from the walkthrough notes.
- The composer's `maxContextTokens` failure on the box — box-side, needs SSH.
- Retiring `TICKET_GITHUB_TOKEN`'s org-wide scope (FB-072, unchanged).

## Acceptance criteria

- [x] Run reports and approvals are read via `owner/slug`; unit tests pin the exact strings.
- [x] The attestation is signed and verified over the same string the executor uses.
- [x] An already-qualified repo name is never double-prefixed.
- [x] A non-404 run-report failure renders as "could not be read", not "no lane".
- [x] E2e fixtures are signed the way a real grant is signed.

## Verification

598 unit tests green (6 new pinning the boundary; 2 pre-existing Windows-only bash-path failures
unrelated). 13/13 e2e green across approvals, budgets and the board after re-signing fixtures.
Post-merge, the live check is the one that matters: the ARCA board must show the lane's real
heartbeat and run history — verified against the running system, not asserted from the suite.
