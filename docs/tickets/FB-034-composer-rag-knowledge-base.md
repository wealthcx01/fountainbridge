# FB-034 — Persistent venture knowledge base for the composer (RAG)

**Status:** Done · **Phase:** 3 · **Depends on:** FB-033 (composer agent + tool wired)
**Repo:** fountainbridge (+ ARCA Hetzner VM)
**Branch:** `fb-034-composer-rag-knowledge-base` · One ticket = one branch = one PR.

## Why this matters (for the founder)
Right now the composer only sees files you attach to the *current* chat. This gives your venture a
memory: drop your deck, research, pricing notes and data in once, and from then on the composer can
search them and cite them when it shapes a ticket — so the work reflects what your venture already
knows, without you re-explaining it every time.

## Context
FB-025 enabled per-chat file uploads (`fileConfig`). A persistent, searchable store is a further
step: LibreChat's **`rag_api`** service + a **pgvector** store. The knowledge base is
**venture-scoped**: ARCA's box holds only ARCA's files (non-negotiable 6).

**Decisions (recorded here):**
- **Embeddings run ON THE BOX** (John, 2026-07-29): the **full** `librechat-rag-api-dev` image (not
  `-lite`) runs a local HuggingFace `sentence-transformers/all-MiniLM-L6-v2` model on CPU. Venture
  file contents never leave the VM — the strongest reading of D1 isolation — with no new API key and
  no per-use cost. (The alternative, OpenAI/Voyage embeddings, would ship file chunks off-box.)
- **Vectors in a local pgvector Postgres** sidecar (`pgvector/pgvector:0.8.0-pg15-trixie`), a
  `POSTGRES_PASSWORD` generated on the box (never in the repo, non-negotiable 8).
- **Resource guard:** ARCA's cx23 has 3.7 GB RAM / 2 vCPU / no swap. The embeddings model + torch
  can spike, so the bring-up **adds 2 GB swap** first.

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
