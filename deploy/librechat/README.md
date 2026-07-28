# LibreChat on a venture box (FB-025)

The conversational composer's chat surface, run on the venture's **own** Hetzner box (D1 — one per
venture, never shared). This is the deploy recipe; the design + agent brief are in
`docs/librechat-composer.md`. Reasoning is **Claude** (Anthropic endpoint).

## What's here
- `docker-compose.yml` — LibreChat API + MongoDB + Meilisearch (minimal). API bound to `127.0.0.1`;
  the box's Caddy terminates TLS and proxies to it — never exposed directly.
- `.env.example` — venture config. Copy to `.env` **on the box** and fill in. No secrets in this repo.
- `librechat.yaml` — locks the model surface to Claude.

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

## Verify
- `curl -s localhost:3080` returns the LibreChat app.
- Google sign-in works **only** with the venture Workspace account; other accounts/domains are refused.
- A message gets a Claude reply.

## Auth posture
Password login and open registration are **off**; sign-in is Google-only, restricted to the venture's
Workspace domain (`ALLOWED_REGISTRATION_DOMAINS`) — the Holy Corner vertical-login pattern. One box =
one venture, so isolation is physical.

> Versions here are a starting point (LibreChat moves fast). Pin/verify on the box; then wire the
> ticket-shaping agent per `docs/librechat-composer.md`.
