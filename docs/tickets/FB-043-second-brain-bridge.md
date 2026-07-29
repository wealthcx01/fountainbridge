# FB-043 — Second-brain bridge: composer deposits → git context/library → the lanes

**Status:** In review · **Phase:** 2/3 · **Depends on:** FB-033 (composer write-path), FB-039/040
(lane runtime) · **Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-043-second-brain-bridge` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Until now, the things you told the composer (your audience, brand, pricing) lived only in the chat —
the agents that actually do the work couldn't see them. This closes that gap: tell the composer a
durable fact once, and every lane doing your work reads it. One brain, shared by you and the agents.

## Context
The audit found the founder's knowledge (FB-034 RAG uploads, FB-036 memory) was **siloed in
LibreChat** — the lanes couldn't read it, and D8 wants it in **git `context/`/`library/`, indexed by
gbrain** (the method doc: "gbrain over the venture repo plays Archon's RAG role"). This bridges the
two: the composer deposits durable facts to git; the lanes read git during RESEARCH.

## Scope
- **D8 substrate:** seed `context/` (durable background, department-tagged: `context/build|sell|scale`)
  + `library/` (artifacts) in the venture repo, with a README convention.
- **Deposit tool** (`deploy/librechat/deposit-mcp/stdio.mjs`): a zero-dep stdio MCP tool
  `deposit_venture_file` on the composer — the founder saves a durable fact/file, it is
  **secret/PII-scanned** (a pasted key/password/token is rejected, never written to git history), then
  committed to `context/<dept>/<slug>.md` (or `library/`) as a **PR a human OKs**. Wired into
  `librechat.yaml` (`mcpServers.deposit`) + the composer agent (seed).
- **The lane reads it:** the supervisor's RESEARCH step points the Claude Code lane at `context/`, so
  the founder's deposited knowledge informs the work.
- Composer instruction: offer to save durable venture facts; never save secrets.

## Out of scope
- Semantic gbrain indexing on the box (the lane reads `context/` directly for now; gbrain install +
  index is the next enhancement). Heavy binaries → object storage + pointer (the tool handles text;
  binaries flagged). LibreChat pgvector ↔ git reconciliation (git is the durable source; the composer
  can read `context/` in a later pass).

## Acceptance criteria
- [x] `context/` + `library/` exist in the arca repo (D8).
- [x] The deposit tool saves a founder fact to `context/<dept>/` as a PR; a **secret is rejected**
      (never committed) — both verified live.
- [x] After merge, a lane working a ticket **reads the deposited context and uses it** — verified:
      the lane produced "ARCA is for competitive graded-card investors who track PSA population and
      price momentum", echoing the deposited `context/sell/ideal-customer.md`.
- [x] No secrets in git; a human merges the deposit PR (the gate).

## Verification
`/review` + CI (shellcheck-clean). Live on ARCA's box: deposit → PR (secret-scanned) → merge → the
autonomous lane read the context and reflected it in its output. Test artifacts cleaned up; the D8
substrate kept.
