# Deploying the Foundry Studio (FB-009)

Host: **Railway** (D6, amended 2026-07-21 from Vercel — the studio's in-memory read-caches want a
long-running server, and ventures already run on Hetzner VPS). Data: **Supabase** (used as Postgres
from Phase 2 on; the read-only studio needs none yet). Auth: **Google OAuth**.

> The code + config in this PR is complete. **The live deploy needs your accounts/credentials** —
> the steps below are [MANUAL]. Nothing is provisioned by the lane.

## 1. Railway service

`railway.json` (in the repo root) configures a NIXPACKS build, `npm run start`, and a healthcheck at
`/api/health`. On Railway:

1. New Project → Deploy from the `wealthcx01/fountainbridge` GitHub repo (branch `main` after the
   stack merges).
2. Railway auto-detects Next.js: builds `npm run build`, starts `npm run start`, injects `PORT`
   (Next respects it). Healthcheck `/api/health` returns `{"status":"ok"}` and is public (excluded
   from the auth middleware).
3. Add the environment variables below.

## 2. Environment variables (Railway → Variables)

| Var | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` (set in code too; harmless) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from the Google OAuth client (step 4) |
| `STUDIO_ADMIN_EMAILS` | `john.gallagher@wealthcx.com` (comma-separated for more admins) |
| `GITHUB_TOKEN` | org-scoped read PAT (or a GitHub App token) so lanes/tickets/PRs render |
| `GITHUB_ORG` | `wealthcx01` (default; set if different) |

Do **not** set `E2E_TEST_LOGIN`, `*_FIXTURE_DIR`, or `E2E_TEST_LOGIN_SECRET` in production — those
are test-only seams and the app treats them as such.

## 3. Domain (Holy Corner vertical-login pattern)

Point a subdomain at the Railway service — e.g. **`foundry.<main-domain>`**, consistent with how
grassmarket's login site is exposed. Agree the exact subdomain, add it as a Railway custom domain,
and let Railway issue HTTPS.

## 4. Google OAuth client

Google Cloud Console → Credentials → OAuth 2.0 Client (Web):

- **Authorized redirect URI:** `https://foundry.<main-domain>/api/auth/callback/google`
- Copy the client ID + secret into the Railway vars above.
- Scopes: default (email/profile) — the studio only needs the signed-in email for scoping.

## 5. Uptime monitor

The pane of glass must not die silently. Point an external monitor (UptimeRobot, Better Uptime,
Railway's own healthcheck, or a cron ping) at `https://foundry.<main-domain>/api/health` — expect
HTTP 200 + `{"status":"ok"}`. Alert to wherever John watches.

## 6. Phase-1 exit test (FB-010 gate)

Once live: run one full working morning of the **ARCA** venture through the studio **from a phone
only** (390×844 verified in the CI mobile UI-gate). Log every gap as a ticket — that evidence is
what FB-010's retro turns into the Phase-2 backlog.

## Preview environments (the Vercel feature we traded away)

Railway supports **PR environments** — enable them so each PR gets an ephemeral URL, restoring the
"founder clicks a link and sees the change" power path (parity §3) that FB-007's attention queue
surfaces via `previewUrl`. Configure under the Railway project's environments settings.
