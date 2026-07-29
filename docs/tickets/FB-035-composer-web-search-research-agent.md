# FB-035 — Web search + research agent(s) for ticket context

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-033 (composer agent + tool wired)
**Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-035-composer-web-search-research-agent` · One ticket = one branch = one PR.

## Why this matters (for the founder)
A good piece of work is grounded in what's actually happening in the market. This lets the composer
look things up — competitors, pricing, what's standard — so the ticket it shapes is informed, not
guessed. You get better-scoped work without doing the research yourself.

## Context
LibreChat has a built-in **`web_search`** capability (search + scrape/rerank providers configured in
`.env`). **Decision (recorded): enable `web_search` and add a dedicated research agent** (endpoint
`agents`) tuned to gather market/competitor/pricing context and hand a crisp brief back to the
composer — rather than overloading the composer itself. Reasoning stays on Claude. Read-only
research: no external *sends*, so this stays inside the engineering gate, not the ActiveGraph gate.

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
