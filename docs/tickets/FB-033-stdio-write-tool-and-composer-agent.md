# FB-033 — Composer write path via stdio MCP + the Foundry Composer agent

**Status:** Done · **Phase:** 3 · **Depends on:** FB-025 (composer surface live),
FB-030 (arca tickets render) · **Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-033-stdio-write-tool` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Today the Foundry composer can *shape* a ticket but can't *file* one — the founder still has no
button that turns "yes, do it" into a real piece of work on their board. This closes that loop:
say what you want, approve the read-back, and a proper ticket appears on your venture board for the
team to pick up. Nothing merges without a human — approval opens a PR, it doesn't ship anything.

## Context
FB-025 stood up LibreChat on ARCA's box with a ticket-shaping composer and a write tool
(`deploy/librechat/ticket-mcp`, a **streamable-http** MCP server in a sibling container). The tool
is built and running but **not connected**: LibreChat's SSRF guard rejects the internal MCP URL
(`Domain "http://ticket-mcp:3100" is not allowed`), and per-server `allowedDomains`/`allowedAddresses`
did not clear it (that allowlist only governs network transports). Live api log: `Initialized with
1 configured server and 0 tools`.

**Decision (recorded here): switch the transport to `stdio`.** Per the LibreChat docs, `stdio` MCP
servers spawn as a local child process of the api container and **bypass the domain/address
allowlist entirely** — there is no URL for the SSRF layer to reject. This is the durable fix, not a
tunnel/allowlist hack.

**Decision: zero-dependency single-file server.** The stdio server is spawned by the api container's
own `node` (v24, global `fetch` present). Rather than couple to the image's bundled
`@modelcontextprotocol/sdk` (which can drift as LibreChat tracks `:latest`) or mount a `node_modules`
tree, the server implements the MCP JSON-RPC handshake (`initialize` / `tools/list` / `tools/call`)
directly. It depends only on `node` + built-in `fetch` — portable across image churn, one mounted
file, no build.

**Decision: seed the Foundry Composer agent into Mongo idempotently.** LibreChat agents live in the
database (no declarative YAML), and MCP tools only attach to an `agents`-endpoint agent. To keep the
agent reproducible on a fresh box (not a hand-clicked artifact), the deploy recipe upserts a
fixed-`id` "Foundry Composer" agent (composer system prompt + the `ticket-filer` tool) via a seed
step, and the default modelSpec points at it.

## Scope
- Rewrite `deploy/librechat/ticket-mcp/` as a **stdio** MCP server (`stdio.mjs`, zero-dep), reusing
  the existing `fileTicket()` GitHub logic (new branch → commit `docs/tickets/<slug>.md` →
  open PR on `VENTURE_REPO`; slug guard preserved). Keep a `--file '<json>'` self-test mode.
- Retire the streamable-http `server.js` + the `ticket-mcp` sibling container (one write path, no
  drift). Mount `stdio.mjs` into the api container read-only.
- `librechat.yaml`: replace the `type: streamable-http` server with
  `ticket-filer: { type: stdio, command: node, args: [<path>], env: { TICKET_GITHUB_TOKEN, VENTURE_REPO }, stderr: inherit, serverInstructions: true }`.
- Add an **idempotent agent seed** (`deploy/librechat/seed-agent.mjs`, run on the box) that upserts
  the "Foundry Composer" agent (system prompt + `ticket-filer` tool, `anthropic`/`claude-sonnet-5`)
  and set it as the default so the founder lands on the tool-using composer.
- Update `deploy/librechat/README.md` + `docs/librechat-composer.md` with the stdio recipe, the
  token requirement, and the agent-seed step.
- Fail-closed: with no `TICKET_GITHUB_TOKEN` the tool still registers and returns a plain
  "installed but not yet authorized" message (never a silent no-op).

## Out of scope
- RAG / persistent knowledge base (FB-034), web search / research agents (FB-035), connectors +
  conversation starters + memory (FB-036), the founder→lane execution mechanism (FB-037).
- Any change to how the studio renders the board (FB-030 already covers arca's default branch).
- **No `execute_code` / code interpreter** on the founder surface (John, explicit) — founders are
  non-technical; execution stays with the agent lanes. This ticket must not enable it.

## Acceptance criteria
- [ ] The api log reads `Initialized with 1 configured server and 1 tool` (was `0 tools`); the SSRF
      error is gone.
- [ ] The "Foundry Composer" agent exists on a fresh box via the seed step, carries the
      `file_venture_ticket` tool + the composer prompt, and is the founder's default.
- [ ] With `TICKET_GITHUB_TOKEN` unset, calling the tool returns the plain "not yet authorized"
      message (fail-loud, no crash).
- [ ] **With the token set (John provides):** describe → draft → approve opens a **PR on
      `wealthcx01/arca`** adding `docs/tickets/<slug>.md`, and that ticket renders on the ARCA board
      in the studio. A human still merges the PR (non-negotiable 2 + 4).

## Verification
/review (incl. adversarial subagent) + repo CI green (lint/typecheck/test). On the box: `tools/list`
shows the tool, fail-closed message verified without the token, full describe→PR→board loop walked
once the token is set. External gate intact — the PR is opened for a human to merge, nothing merges
or ships automatically.
