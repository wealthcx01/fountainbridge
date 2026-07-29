# FB-034 — Persistent venture knowledge base for the composer (RAG)

**Status:** Planned · **Phase:** 3 · **Depends on:** FB-033 (composer agent + tool wired)
**Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-034-composer-rag-knowledge-base` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Right now the composer only sees files you attach to the *current* chat. This gives your venture a
memory: drop your deck, research, pricing notes and data in once, and from then on the composer can
search them and cite them when it shapes a ticket — so the work reflects what your venture already
knows, without you re-explaining it every time.

## Context
FB-025 enabled per-chat file uploads (`fileConfig`). A persistent, searchable store is a further
step: LibreChat's **`rag_api`** service + a **pgvector** store. **Decision (recorded): pgvector on a
Postgres sidecar** on the venture box (self-hosted, venture-isolated per D1 — never a shared store),
embeddings via the portfolio-standard provider, wired per the LibreChat RAG docs. The knowledge base
is **venture-scoped**: ARCA's box holds only ARCA's files (non-negotiable 6).

## Scope
- Add `rag_api` + a `pgvector` Postgres service to `deploy/librechat/docker-compose.yml`, wired to
  the api per the docs (`RAG_API_URL`, embeddings config in `.env`), venture-isolated on the box.
- A durable place + convention for the founder to deposit durable files (a "knowledge base" upload
  surface / folder), distinct from ephemeral per-chat attachments.
- The Foundry Composer agent gains `file_search` over the store so it can retrieve + **cite**
  venture files when shaping a ticket.
- Docs: the RAG recipe + how a founder adds/refreshes knowledge, in `docs/librechat-composer.md` +
  the box README.

## Out of scope
- Web/market research (FB-035) — this is retrieval over the founder's *own* files only.
- Cross-venture or shared knowledge bases (D1 isolation forbids it).
- Any auto-ingest of the venture *repo* (a possible later ticket; here it's founder-deposited files).

## Acceptance criteria
- [ ] `rag_api` + pgvector run on ARCA's box; the store is venture-isolated.
- [ ] A founder can deposit a file once and, in a *new* chat, the composer retrieves + cites it.
- [ ] Embeddings/keys live only in the box `.env` (non-negotiable 8) — never in the repo.
- [ ] No `execute_code` introduced.

## Verification
/review + CI green. On the box: deposit a sample ARCA doc, start a fresh chat, confirm the composer
cites it when shaping a related ticket.
