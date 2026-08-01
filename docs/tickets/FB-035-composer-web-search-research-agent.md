# FB-035 — Web search + research agent(s) for ticket context

**Status:** Done · **Phase:** 3 · **Depends on:** FB-033 (composer agent + tool wired)
**Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-035-composer-web-search-research-agent` · One ticket = one branch = one PR.

## Why this matters (for the founder)
A good piece of work is grounded in what's actually happening in the market. This lets the composer
look things up — competitors, pricing, what's standard — so the ticket it shapes is informed, not
guessed. You get better-scoped work without doing the research yourself.

## Context
LibreChat has a built-in **`web_search`** capability with three parts: a search provider, a scraper,
and an optional reranker. Read-only research: no external *sends*, so this stays inside the
engineering gate, not the ActiveGraph gate. Reasoning stays on Claude.

**Decisions (recorded here):**
- **Provider = Tavily** (John, 2026-07-29): one key does BOTH search and scraping, and it's
  purpose-built for LLM research (clean extracted content), with a generous free tier. Reranker
  `none`. Chosen over Serper+Firecrawl (two keys) and over fully self-hosted SearXNG+Firecrawl —
  the latter is **too heavy for cx23** (Firecrawl self-host needs Redis + a headless browser; the
  box already runs 5 containers + the embeddings model). The `TAVILY_API_KEY` lives only in the box
  `.env` (non-negotiable 8); blank = the capability is present but a search returns nothing.
- **Two agents, not agent-chaining:** give the **composer** `web_search` directly (it checks
  market/competitor/pricing inline while shaping a ticket and folds sourced facts into Context), and
  seed a dedicated **Foundry Research** agent (web_search only, no ticket-filing) for pure research
  sessions. Cleaner + more robust than one agent calling another.
- **`execute_code` stays OUT** of the agents capabilities (John, explicit) — the founder surface
  never runs code.

## Scope
- Enable `web_search` in `librechat.yaml` + the required provider keys in the box `.env` (per the
  LibreChat web-search docs; keys never in the repo).
- Add a **Research** agent (system prompt tuned for market/competitor/pricing scans that inform a
  ticket) with `web_search`; and give the Foundry Composer the ability to draw on it.
- Conversation flow: founder asks / composer decides it needs context → research → the finding feeds
  the shaped ticket's Context section (with sources).
- Docs: the web-search recipe + the research-agent brief in `docs/librechat-composer.md`.

## Out of scope
- Autonomous outbound anything (email/social/CRM) — research reads, it never sends.
- The GTM interest-based sends pipeline (`docs/research-gtm.md` / Phase 4b) — different gate.
- `execute_code` (excluded on the founder surface).

## Acceptance criteria
- [ ] `web_search` works in a chat on the box (a live query returns cited results).
- [ ] A Research agent exists and can produce a short, sourced market/competitor/pricing brief.
- [ ] The composer can incorporate a research finding (with sources) into a shaped ticket's Context.
- [ ] Provider keys live only in the box `.env`; no `execute_code`.

## Verification
/review + CI green. On the box: run a real research query, confirm sourced output and that it can
flow into a ticket's Context.
