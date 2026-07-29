# LibreChat on a venture box (FB-025)

The conversational composer's chat surface, run on the venture's **own** Hetzner box (D1 — one per
venture, never shared). This is the deploy recipe; the design + agent brief are in
`docs/librechat-composer.md`. Reasoning is **Claude** (Anthropic endpoint).

## What's here
- `docker-compose.yml` — LibreChat API + MongoDB + Meilisearch (minimal). API bound to `127.0.0.1`;
  the box's Caddy terminates TLS and proxies to it — never exposed directly.
- `.env.example` — venture config. Copy to `.env` **on the box** and fill in. No secrets in this repo.
- `librechat.yaml` — locks the model surface to Claude + wires the ticket-filer write tool.
- `ticket-mcp/stdio.mjs` — the **write tool** (FB-033): a zero-dependency **stdio** MCP server that
  files an approved ticket to the venture backlog as a PR. Mounted into the api container and spawned
  by its own `node` — no sibling container, no URL, so it bypasses LibreChat's SSRF/domain allowlist
  (which blocked the earlier streamable-http server). Depends only on `node` + built-in `fetch`.
- `rag_api` + `vectordb` (FB-034): the **knowledge base**. `rag_api` (full image) vectorises the
  founder's files with a **local, on-box** HuggingFace model (embeddings never leave the VM — D1);
  vectors live in a local pgvector Postgres. The composer searches + cites them via `file_search`.

## Bring-up (on the box, after provisioning)
Prereqs: Docker + Docker Compose (installed by the venture provisioning), a DNS record
`chat.<venture>.<domain>` pointing at the box, and the box's Caddy configured to proxy it to
`127.0.0.1:3080`.

```bash
cd /opt/foundry/librechat            # where provisioning drops this recipe
cp .env.example .env
# generate the secrets:
for k in CREDS_KEY JWT_SECRET JWT_REFRESH_SECRET MEILI_MASTER_KEY; do
  sed -i "s|^$k=.*|$k=$(openssl rand -hex 32)|" .env
done
sed -i "s|^CREDS_IV=.*|CREDS_IV=$(openssl rand -hex 16)|" .env
# then edit .env: set DOMAIN_*, ANTHROPIC_API_KEY, GOOGLE_CLIENT_ID/SECRET, ALLOWED_REGISTRATION_DOMAINS.
docker compose up -d
docker compose ps        # api + mongodb + meilisearch healthy
```

## The write tool (FB-033)
The ticket-filer is a **stdio** MCP server: `librechat.yaml` declares
`mcpServers.ticket-filer: { type: stdio, command: node, args: ["/app/foundry/ticket-filer.mjs"] }`,
and `docker-compose.yml` mounts `./ticket-mcp/stdio.mjs` there read-only. It needs a write token:

```bash
# on the box, in /opt/foundry/librechat/.env
TICKET_GITHUB_TOKEN=<fine-grained PAT: Contents:write + Pull requests:write on VENTURE_REPO>
VENTURE_REPO=wealthcx01/arca
docker compose up -d --force-recreate api   # .env (env_file) is read on RECREATE, not restart
```

> Gotcha: a change to the mounted `librechat.yaml` reloads with `docker compose restart api`
> (it's a volume mount). A change to `.env` does NOT — `env_file` is only read when the container
> is (re)created, so use `up -d --force-recreate api` after editing `.env`.

### The Foundry Composer agent (seed)
The founder's default surface is the **Foundry Composer** agent — the composer system prompt + the
`file_venture_ticket` tool. LibreChat agents live in Mongo (no YAML), so a fixed, reproducible agent
is seeded with `seed-agent.js`. `librechat.yaml`'s `modelSpecs` then pins it as the default. Order
matters — the founder must have signed in once (that creates their user record, the agent's author):

```bash
# on the box, after the founder has signed in at least once:
docker exec -i librechat-mongodb mongosh --quiet LibreChat < seed-agent.js   # idempotent; re-runnable
docker compose restart api
```

The seed is the single source of truth for the composer prompt (the modelSpec is a thin pointer by
`agent_id`). It grants the agent PUBLIC VIEW (visible to every venture founder) + owner to the author.

### The knowledge base (RAG, FB-034)
`rag_api` + `vectordb` vectorise the founder's files with a **local, on-box** embeddings model, so
file contents never leave the VM (D1). Bring-up:

```bash
# on the box, in /opt/foundry/librechat/.env — set a DB password (never in the repo):
POSTGRES_PASSWORD=$(openssl rand -hex 24)
# small box: add swap first (the embeddings model + torch can spike RAM):
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
docker compose up -d          # pulls the full rag-api image + pgvector, starts both
```

First start downloads the embeddings model (~90 MB) into the `rag-hf-cache` volume, so later starts
are fast. The api reaches rag_api at `http://rag_api:8000` (`RAG_API_URL`). Verify:

```bash
docker compose ps                                        # rag_api + vectordb up
docker exec librechat-rag-api curl -sf localhost:8000/health && echo " rag_api healthy"
docker logs librechat-rag-api 2>&1 | grep -i "embedding\|model\|started" | tail
```

A founder deposits files via the composer's knowledge/attachments; they are vectorised once and the
composer can `file_search` + cite them in any later chat.

Fail-closed: with the token blank the tool still registers but returns a plain "installed but not
yet authorized" message — it never sends a bad request to GitHub. Verify:

```bash
docker logs librechat-api 2>&1 | grep "configured server"      # => "1 configured server and 1 tool"
docker logs librechat-api 2>&1 | grep "ticket-filer] starting" | tail -1   # authorized=true once token set
# exercise the GitHub path directly (self-test seam), once the token is set:
docker exec librechat-api node /app/foundry/ticket-filer.mjs --file \
  '{"slug":"arca-smoke-test","title":"smoke","body":"# ARCA-NEW — smoke\n"}'   # prints the PR url
```

## Verify
- `curl -s localhost:3080` returns the LibreChat app.
- Google sign-in works **only** with the venture Workspace account; other accounts/domains are refused.
- A message gets a Claude reply.
- `docker logs librechat-api | grep "configured server"` shows `1 configured server and 1 tool` (the
  ticket-filer registered; no `Domain … is not allowed` SSRF error).

## Auth posture
Password login and open registration are **off**; sign-in is Google-only, restricted to the venture's
Workspace domain (`ALLOWED_REGISTRATION_DOMAINS`) — the Holy Corner vertical-login pattern. One box =
one venture, so isolation is physical.

> Versions here are a starting point (LibreChat moves fast). Pin/verify on the box; then wire the
> ticket-shaping agent per `docs/librechat-composer.md`.
