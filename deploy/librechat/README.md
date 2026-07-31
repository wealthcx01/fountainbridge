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

The seed is the single source of truth for the agent prompts (the modelSpecs are thin pointers by
`agent_id`). It seeds BOTH Foundry agents — **Foundry Composer** (ticket-filer + web_search, the
default) and **Foundry Research** (web_search only) — and grants each PUBLIC VIEW (visible to every
venture founder) + owner to the author.

### Letting the studio host the conversation (FB-065)
The composer is now a page **inside the Foundry Studio**; this box is the engine behind it. That runs
over LibreChat's documented Agents API (`/api/agents/v1/chat/completions`), not the internal browser
route, so it does not break on their next release.

```bash
# on the box, after the agent seed:
./enable-agents-api.sh                         # composer agent, the box's first user
./enable-agents-api.sh agent_foundry_research founder@example.com
```

It prints one key. Put it on the **studio** (Railway → Variables) as
`COMPOSER_API_KEY_<VENTURE_ID>` — one key per venture, because one box per venture (D1). It never
goes in this repo (CLAUDE.md #8).

Three things have to be true before that API answers, and the script does all three because missing
any one of them fails in a way that reads like the feature being off:

| | What | If it is missing |
| --- | --- | --- |
| 1 | `interface.remoteAgents.use: true` in `librechat.yaml` | every call 401s |
| 2 | an API key from `/api/api-keys` | every call 401s |
| 3 | a REMOTE_AGENT grant **per agent** | `/v1/models` returns an empty list — the API answers, and has nothing to offer |

LibreChat's own `backfillRemoteAgentPermissions` writes grant 3, but it cannot be driven from outside
the running server (its `~/…` aliases are registered by the app entrypoint), so the script writes the
row in the shape that helper produces, reading `permBits` and `roleId` from the role document.

### Web search (FB-035)
The composer + research agents gather market/competitor/pricing context via **Tavily** (one key does
search + scraping). `librechat.yaml` has the `webSearch` block + `web_search` in the agents
capabilities; set the key on the box:

```bash
# in /opt/foundry/librechat/.env
TAVILY_API_KEY=<tavily.com key>
docker compose up -d --force-recreate api   # .env change → recreate (not restart)
```

Set the key **before** exposing the capability: until `TAVILY_API_KEY` is set, web search is
unavailable and LibreChat may prompt the founder for a key (confusing on a non-technical surface).
The deploy step above sets it, so a properly-provisioned box never shows that prompt.

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

### Status connector + memory (FB-036)
- **Status connector** (`status-mcp/stdio.mjs`) — a second READ-ONLY stdio MCP mounted into the api
  (`mcpServers.status`). Tools `list_open_prs` / `list_recent_activity` let the founder ask "what's in
  review?" and get the venture's real GitHub state. Read-only by construction (GET-only). It reuses
  `TICKET_GITHUB_TOKEN` for reads by default; for least-privilege, provision a genuinely read-scoped
  `STATUS_GITHUB_TOKEN` on the box so token scope backstops the code.
- **Memory** — `librechat.yaml`'s `memory` block + `interface.memories: true`. A cheap background
  agent (`claude-haiku-4-5`) extracts durable founder preferences + venture facts across chats (needs
  `memory.agent.enabled: true`). `validKeys` restricts which memory *categories* are stored; keeping
  *secrets out of values* rests on the extraction prompt — and `interface.memories` lets the founder
  view/delete anything stored.
Both load from the mounted config — a `docker compose up -d` (new mount) then the agent seed picks
up the status tools. No new key: the status connector falls back to `TICKET_GITHUB_TOKEN`.

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
