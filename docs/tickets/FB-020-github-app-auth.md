# FB-020 — GitHub App authentication for repo reads

**Phase:** 1 · **Depends on:** FB-005 · **Repo:** fountainbridge
**Branch:** `fb-020-github-app-auth` · One ticket = one branch = one PR.

## Context
FB-005's `lib/github.ts` reads a static `GITHUB_TOKEN` (a PAT — fine for v0). The production path (and
John's choice for the ARCA dogfood, FB-019) is a **GitHub App**. A GitHub App can't be a static env
token: its installation access tokens **expire after ~1 hour**, so the studio must *mint* a fresh token
from the App's private key at runtime and cache it until near expiry.

Discovered while unblocking FB-019 (ARCA dogfood readiness) — the studio needs App auth before a GitHub
App token can be set on the deploy.

## Scope
- Extend `GitHubClient` to resolve its bearer token per request from one of two sources, in order:
  1. **PAT** — `GITHUB_TOKEN` (or `opts.token`). Unchanged; current behaviour preserved.
  2. **GitHub App** — when `GITHUB_APP_ID` + `GITHUB_APP_PRIVATE_KEY` + `GITHUB_APP_INSTALLATION_ID`
     are set: sign a short-lived RS256 JWT with the App private key, exchange it at
     `POST /app/installations/{id}/access_tokens` for an installation token, and **cache** the token
     until ~5 min before its `expires_at`, re-minting on demand.
- Private key from env may carry escaped `\n`; normalise to real newlines.
- Pure `node:crypto` (no new dependency). Server-only, as today.
- Docs: note the App env vars in `docs/provisioning.md` / deploy notes.

## Out of scope
Write access / the approval-event write path (reads only here). Rotating the App private key.

## Acceptance criteria
- [ ] With only `GITHUB_TOKEN` set, behaviour is byte-for-byte as before (PAT bearer).
- [ ] With the three App vars set (no PAT), the client mints an installation token, uses it, caches it,
      and re-mints after expiry — proven by unit tests with an injected key + mocked token endpoint.
- [ ] No token configured → no `Authorization` header (unchanged).

## Verification
/review + unit tests (`lib/__tests__/github.test.ts`).
