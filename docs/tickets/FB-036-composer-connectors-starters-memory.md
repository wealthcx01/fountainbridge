# FB-036 — Composer connectors, conversation starters, and memory

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-033 (composer agent + tool wired)
**Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-036-composer-connectors-starters-memory` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Makes the composer feel like it *knows your venture*: it can tell you what's already in review, it
opens with a few useful prompts instead of a blank box, and it remembers your preferences across
chats — so you spend less time re-explaining and more time deciding.

## Context
Three LibreChat features, one ticket because they shape the same "does it know me?" surface:
- **Connectors (read-only MCP):** a second stdio MCP that reads the studio's venture status / open
  PRs so the founder can ask "what's in review?" / "what's the team working on?". **Decision:
  read-only** — status/PR reads only, no writes beyond FB-033's ticket-filer.
- **Conversation starters:** a few venture-relevant quick prompts on the composer (LibreChat
  `conversationStarters` / agent-level starters).
- **Memory:** LibreChat's built-in memory so the composer retains founder preferences/context
  across conversations (distinct from FB-034's file RAG — this is conversational memory).

## Scope
- A read-only **status connector** (stdio MCP, same zero-dep pattern as FB-033) exposing e.g.
  `list_open_prs` / `venture_status` for the venture repo, attached to the composer agent.
- Conversation starters on the Foundry Composer (a handful of plain-English prompts).
- Enable LibreChat **memory** per the docs; scope it to the venture instance.
- Docs updated (`docs/librechat-composer.md` + box README).

## Out of scope
- Any *write* connector beyond FB-033's ticket-filer (read-only here).
- The founder→lane execution mechanism (FB-037).
- `execute_code`.

## Acceptance criteria
- [ ] A founder can ask "what's in review?" and get the venture's open PRs (read-only).
- [ ] The composer shows useful conversation starters.
- [ ] Memory persists a stated preference across two separate chats.
- [ ] Read-only connector cannot write; no `execute_code`.

## Verification
/review + CI green. On the box: ask "what's in review?" and confirm real PRs returned; verify a
starter works and a preference survives a new chat.
