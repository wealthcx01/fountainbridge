# FB-284 — Staging and previews get their own read-only GitHub access

**Status:** Todo · **Kind:** small · **Budget:** none yet (John, 28 October 2026) · **Phase:** 3 · **Raised by:** John, 28 October 2026 ("no github access for staging yet; add it to the backlog as a small ticket") · One ticket = one branch = one PR.

## Why

Staging, and every preview copied from it, has none of production's GitHub keys. That is on purpose:
a preview runs code from a pull request that nobody has approved yet.

Without a key, the studio reads GitHub anonymously, and GitHub allows that only 60 times an hour. So
on staging and on every preview, a venture's desk says "GitHub rate limit hit" and "Could not read
wealthcx01/arca". A founder opening a preview to look at their team's work sees an empty page.

## What to do

- Make a GitHub credential for staging only, which can **read** the ventures' repositories and do
  nothing else. A fine-grained personal access token is enough: read-only access to contents, issues
  and pull requests, on the venture repositories only. The studio already uses `GITHUB_TOKEN` when
  it is set (`lib/github.ts`), so no code should need to change.
- John makes it and sets it as `GITHUB_TOKEN` in staging's variables. It never goes in this
  repository or in a chat.
- Never production's GitHub App key, and never a credential that can write: a preview could use it.

## Done when

- [ ] Staging's desk for ARCA reads its tickets and work with no "rate limit" or "could not read"
      line, at 1440×1000 and 393×851.
- [ ] A preview does the same.
- [ ] A write with the credential (for example, adding a label) is refused by GitHub.
- [ ] No staging variable matches production's, checked by fingerprint.
- [ ] Every command in `CLAUDE.md` `## Checks` passes.

## Out of scope

Production's GitHub App, and any change to what the studio reads.
