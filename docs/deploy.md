# Deploying the Foundry Studio (FB-009)

Host: **Railway** (D6, amended 2026-07-21 from Vercel — the studio's in-memory read-caches want a
long-running server, and ventures already run on Hetzner VPS). Data: **Supabase** (used as Postgres
from Phase 2 on; the read-only studio needs none yet). Auth: **Google OAuth**.

> The code + config in this PR is complete. **The live deploy needs your accounts/credentials** —
> the steps below are [MANUAL]. Nothing is provisioned by the lane.

## 1. Railway service

`railway.json` (in the repo root) configures a NIXPACKS build, `npm run start`, a healthcheck at
`/api/health` (100-second timeout), and a restart-on-failure policy with 3 retries. Railway stops
reading `railway.json` on **2026-12-01**; `.railway/railway.ts` holds the same settings for after that
(FB-229, below). On Railway:

1. New Project → Deploy from the `wealthcx01/fountainbridge` GitHub repo (branch `main` after the
   stack merges).
2. Railway auto-detects Next.js: builds `npm run build`, starts `npm run start`, injects `PORT`
   (Next respects it). Healthcheck `/api/health` returns `{"status":"ok"}` and is public (excluded
   from the auth middleware).
3. Add the environment variables below.

### Moving from `railway.json` to `.railway/railway.ts` (FB-229)

**What changed.** Railway is retiring `railway.json` ("config as code") on 2026-12-01 in favour of
`.railway/railway.ts` ("infrastructure as code"). The new file is in the repo and carries the same
five settings. `lib/railway-config.test.ts` fails the build if any of them is lost or changed, and
also if the two files disagree while both exist.

**The one thing to understand.** Railway reads `railway.json` every time it deploys. It never reads
`.railway/railway.ts` on its own. The new file only does anything when a person runs
`railway config apply`, once per environment. Merging it changes nothing on Railway.

**What `railway config migrate` got wrong.** Its draft dropped the builder and the restart policy. It
also left out the GitHub source and the variables, and Railway treats anything left out as "delete
it": applied to staging, that draft would have deleted all eight variables (the sign-in keys among
them) and disconnected the service from GitHub. The file in the repo was written by hand to avoid all
of that. Do not regenerate it with `migrate`.

**Steps, in order. Staging first, then production, never in the same sitting as another deploy change.**

1. `railway link -p foundry-studio -e staging -s foundry-studio` (this only changes which environment
   your own terminal points at).
2. `railway config plan --verbose`. Read every line. It must say **0 to destroy**. The only changes it
   should show are the five settings moving in. If it lists any variable to delete, add that name to
   the `env` list in `.railway/railway.ts` as `preserve()` and plan again. Do not apply a plan that
   destroys anything.
3. `railway config apply`. Then watch the next staging deploy: it must go green, and the deploy's
   settings in the Railway console must show the health check at `/api/health`.
4. Repeat steps 1 to 3 with `-e production`.
5. Only then delete `railway.json`, in its own pull request.

The `railway` command evaluates the file with the `railway` npm package, which this repo does not
install. To run `plan`, install it somewhere outside the repo and link it in as
`.railway/node_modules` for the duration (that folder is ignored by git). The CLI also checks its own
version by running `$_ --version`, so call `railway` directly, not through `timeout` or another
wrapper, or it reports a false "CLI too old" error.

## 2. Environment variables (Railway → Variables)

| Var | Value |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | `true` (set in code too; harmless) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from the Google OAuth client (step 4) |
| `STUDIO_ADMIN_EMAILS` | `john.gallagher@wealthcx.com` (comma-separated for more admins) |
| `GITHUB_TOKEN` | **PAT path (v0):** org-scoped read PAT so lanes/tickets/PRs render. Takes precedence over the App vars below if both are set. |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` / `GITHUB_APP_INSTALLATION_ID` | **GitHub App path (production, FB-020):** set all three (and leave `GITHUB_TOKEN` unset) to have the studio mint short-lived installation tokens from the App key. The private key is the App's `.pem`; escaped `\n` in the env value is normalised automatically. |
| `GITHUB_ORG` | `wealthcx01` (default; set if different) |
| `FOUNDRY_APPROVAL_SECRET` | **FB-046/044 external-action gate:** the HMAC secret the studio uses to sign approval grants **and to verify them on read**. Absent, the studio cannot check any approval: every approval card renders a warning saying so, and (because the executor may still hold a working secret) an approved action can still go out. Must be **identical** to the value on each venture's gated executor, and must **never** be set on a lane box. `openssl rand -hex 32`. |
| `STUDIO_APPROVAL_GITHUB_TOKEN` | **FB-046:** a write-scoped token for the venture's `foundry-approvals` ref (the read App/PAT stays read-only). Absent → the Approve button reports "approvals not set up yet". |

Use **one** of the two GitHub auth paths: a `GITHUB_TOKEN` PAT, or the three `GITHUB_APP_*` vars.
App installation tokens expire hourly, so a GitHub App must go through the `GITHUB_APP_*` path (a
raw App token pasted into `GITHUB_TOKEN` would stop working after ~1 hour) — see FB-020.

Do **not** set `E2E_TEST_LOGIN`, `*_FIXTURE_DIR`, or `E2E_TEST_LOGIN_SECRET` in production — those
are test-only seams and the app treats them as such.

### Onboarding a venture repo (so its board isn't empty) — FB-021

A venture board reads tickets from `docs/tickets/` on the repo's **default branch**, via the GitHub
auth above. For a board to populate, the repo must be onboarded on **both** axes — access *and* content:

1. **Access** — the studio's credential must be able to *read* the repo:
   - **GitHub App path:** install the Foundry GitHub App **on that specific repository** (or the whole
     account) with **`Contents: read`** + **`Metadata: read`** permissions. A private repo the App
     isn't installed on returns HTTP 404 — indistinguishable from a missing repo — so an install/scope
     gap looks like "not found". Installing the App is a **human action** (GitHub → the App →
     *Install / Configure* → select the repos); it cannot be done from this lane.
   - **PAT path:** the `GITHUB_TOKEN` PAT must be scoped to read the repo.
2. **Content** — the ticket backlog must live under `docs/tickets/` on the **default branch**
   (`main`/`master`). Tickets on a side branch won't show; the default branch is the contract (D2).

**Repos to onboard now:** `wealthcx01/arca` (default `master`), `wealthcx01/thereset-platform`,
`wealthcx01/thereset-marketing`.

How the board reports each state (so a founder can tell "not set up yet" from "broken"):

| Studio shows | Meaning | Fix |
|---|---|---|
| "isn't connected to GitHub yet" | No `GITHUB_TOKEN`/`GITHUB_APP_*` configured at all | Set the auth vars above |
| "Can't read <repo> … credentials don't have read access" | Auth set, but no access to this repo — App not installed, or App/PAT lacks `contents: read` (both a missing repo and a 403 "not accessible by integration" land here) | Install/scope the App on the repo, or scope the PAT |
| "No tickets on the default branch (`<ref>`)" | Reachable, but backlog not on the default branch | Merge the backlog to the default branch (e.g. FB-030 for arca) |

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
