# FB-243 — a preview link sends the reviewer to production, and nothing on screen says so

**Status:** Open · **Phase:** 3 · **Found by:** FB-230's live check, 2026-10-01

## Reproduce it in one command

Against the preview Railway built for pull request 315 on 2026-10-01:

    $ curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" \
        https://foundry-studio-fountainbridge-pr-315.up.railway.app/

    307 https://foundry-studio-production-4a73.up.railway.app/login?callbackUrl=...

**The preview serves production.** A reviewer opens the link expecting to see the pull request's work,
sees `main` instead, and has nothing on the screen that could tell them otherwise.

## Why

Railway **forks a preview environment from production and inherits its variables**. `AUTH_URL` is one
of them. A literal production URL in production therefore becomes a literal production URL in every
preview, and Auth.js redirects there.

This lane's notes from 2026-08-04 record the same trap on pull request 67 and the fix:

> `AUTH_URL=https://${{RAILWAY_PUBLIC_DOMAIN}}` — Railway resolves the reference per environment, so
> production, staging and every preview each point at themselves.

The fix was applied to the environments that existed then. It was not applied in the one place that
would make it stick: **the value a new preview inherits**. So every preview created since has the
fault again, and will keep having it.

## Why this is worth its own ticket

FB-230's closing claim is that *"the moment Railway creates one environment, the link appears with no
further work."* The link does appear. It goes to the wrong place.

So the feature the Foundry is waiting on — **a founder clicking through to see their work running**
— would, the day it started working on ARCA, show them the wrong application. That is worse than no
link: a missing link is visibly missing, and a wrong one is invisibly wrong. It is the same shape as
FB-151, where a probe measured two pages that had both redirected elsewhere.

It also lands directly in FB-239's path. One machine per ticket is only worth building if the link at
the end of it is true.

## Scope

- Set `AUTH_URL` so that a forked environment resolves it to **itself**, not to whatever it was
  copied from. The reference form is in the note above.
- Prove it on a real preview: open a pull request, follow the link, confirm it lands on the preview's
  own domain and not production.
- A check that fails when a preview link redirects off its own host — this is exactly the class of
  fault that a health endpoint returning 200 does not catch, and the reason the note says so.
- Decide what happens for a preview a founder cannot sign in to at all: Google OAuth redirect URIs
  are exact-match with no wildcards, so a per-pull-request domain cannot be pre-registered. The
  password door (FB-092) may be the answer for previews, or previews may be for reviewers rather than
  founders. That is a product decision, and it is the reason this ticket does not simply say "fix the
  variable".

## Acceptance criteria

- [ ] A preview link opens the preview, at both viewports, and nothing about it says production.
- [ ] The fix is in the value a NEW preview inherits, not applied by hand per environment.
- [ ] A check fails when a preview redirects off its own host.
- [ ] It is written down what a founder — as opposed to a reviewer — can do with a preview link,
      given that OAuth cannot allowlist per-pull-request domains.

## What needs a human

**Changing `AUTH_URL` on production is a high-blast-radius infrastructure change** — it is the
variable that decides where sign-in sends people. Under the D7 approval matrix that is dual-approve,
so it is not done here. The reproduction, the cause and the fix are all above; the change is one
variable.
